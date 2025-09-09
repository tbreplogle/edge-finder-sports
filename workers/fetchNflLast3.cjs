/* ---------------------------------------------------------------------- */
/*  Polyfill for File (needed by undici on Node ≤ 18)                     */
/* ---------------------------------------------------------------------- */
const { Blob } = require('buffer');
if (typeof globalThis.File === 'undefined') {
  class File extends Blob {
    constructor (parts, name, opts = {}) {
      super(parts, opts);
      this.name         = String(name);
      this.lastModified = opts.lastModified ?? Date.now();
      this.type         = opts.type ?? '';
    }
  }
  globalThis.File = File;
}

/* ---------------------------------------------------------------------- */
/*  CJS-friendly static imports                                           */
/* ---------------------------------------------------------------------- */
const fs       = require('fs');
const axios    = require('axios');
const { load } = require('cheerio');

/* ---------------------------------------------------------------------- */
/*  Axios client with browser-like headers (avoid anti-bot markup)        */
/* ---------------------------------------------------------------------- */
const AX = axios.create({
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  },
  timeout: 20000,
  // Treat 3xx as OK so we can follow server-side redirects manually if needed
  validateStatus: s => s >= 200 && s < 400
});

/* ---------------------------------------------------------------------- */
/*  Main body – everything else inside one async IIFE                     */
/* ---------------------------------------------------------------------- */
(async () => {

  /* ---------- dynamic ESM-only deps ----------------------------------- */
  const { default: pLimit }  = await import('p-limit');
  const { createClient }     = await import('@supabase/supabase-js');

  /* ---------- Config -------------------------------------------------- */
  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE,
    { auth: { persistSession: false } }
  );

  const nfl    = sb.schema('nfl');
  const limit  = pLimit(12);           // don’t hammer; 12 is plenty
  const SEASON = 2024;                 // flip in August as needed
  const WEEK   = 17;                   // soon make dynamic if you want

  /*  To test historic boards set, e.g.
      DISCOVER_DATE=2024-12-31 node fetchNflLast3.cjs                   */
  const DISCOVER_DATE = process.env.DISCOVER_DATE || null;
  const DEBUG = String(process.env.DEBUG || '').toLowerCase() === 'true';

  /* ---------- Helpers ------------------------------------------------- */
  const clean = s => (s ?? '').replace(/\u00A0/g, ' ').trim();

  const sanitize = n => clean(n)
    .replace(/\s+Stats.*$/i,  '')
    .replace(/\s+Team.*$/i,   '')
    .replace(/\s+Football$/i, '');

  const safeDivide = (n, d) =>
    d === 0 ? null : Number.isFinite(n / d) ? n / d : null;

  const logPg = e => console.error(
    'STATUS :',  e?.status,
    '\nMESSAGE:', e?.message,
    '\nDETAIL :', e?.details,
    '\nCODE   :', e?.code
  );

  /* ---------- Team dictionary ----------------------------------------- */
  const { data: teams, error } = await nfl
    .from('teams')
    .select('team_id,team_name,abbreviation,alt_name');
  if (error) throw error;

  const NAME_MAP = Object.fromEntries(teams.map(t => [sanitize(t.team_name), t.team_id]));
  const ABBR_MAP = Object.fromEntries(teams.map(t => [String(t.abbreviation || '').toUpperCase(), t.team_id]));

  const idFromNameOrAbbr = (longName, abbr, hubText) => {
    const name = sanitize(longName);
    if (NAME_MAP[name]) return NAME_MAP[name];

    const up = (abbr || '').toUpperCase();
    if (ABBR_MAP[up]) return ABBR_MAP[up];

    // Fallback: partial + alt_name presence in hub text
    const cand = teams.filter(t =>
      t.team_name.startsWith(name) && hubText.includes(t.alt_name)
    );
    if (cand.length === 1) return cand[0].team_id;

    throw new Error(`Unmapped team: "${longName}" / "${abbr}"`);
  };

  const deriveAbbr = n => {
    if (!n) return '';
    const caps = n.match(/[A-Z]/g);
    return caps ? caps.slice(-3).join('').toUpperCase() : '';
  };

  /* ---------- Discover matchup IDs ------------------------------------ */
  async function discoverMatchups () {
    const base = 'https://www.covers.com/sports/nfl/matchups';
    const url  = DISCOVER_DATE ? `${base}?selectedDate=${DISCOVER_DATE}` : base;

    const res = await AX.get(url);
    const $   = load(res.data);

    const ids = new Set();
    $("a[href*='/sport/football/nfl/matchup/']").each((_, el) => {
      const m = $(el).attr('href')?.match(/matchup\/(\d+)/);
      if (m) ids.add(+m[1]);
    });

    if (!ids.size) {
      const snippet = clean($('body').text()).slice(0, 300);
      throw new Error(`No matchup IDs found. Likely anti-bot or markup change.\nBody snippet: ${snippet}`);
    }
    return [...ids];
  }

  /* ---------- Parse og:title helper ----------------------------------- */
  const namesFromOg = title => {
    const parts = title.split(/\s+vs\.?\s+/i);
    if (parts.length < 2) return [null, null];

    const away = sanitize(parts[0]);
    const home = sanitize(
      parts[1].split(/\s(?:Odds|Picks|Predictions|Preview|Betting|-\s|\|\s)/i)[0]
    );
    return [away, home];
  };

  /* ---------- Scrape a single matchup --------------------------------- */
  async function scrapeMatchup (id) {
    // Hub page (for names + date)
    const hubRes  = await AX.get(`https://www.covers.com/sport/football/nfl/matchup/${id}`);
    const $hub    = load(hubRes.data);
    const hubText = $hub.text();

    let awayFN = clean($hub('div.matchup-team.away-team').attr('data-team-fullname'));
    let homeFN = clean($hub('div.matchup-team.home-team').attr('data-team-fullname'));
    let awayAb = clean($hub('div.matchup-team.away-team').attr('data-team-abbrev'));
    let homeAb = clean($hub('div.matchup-team.home-team').attr('data-team-abbrev'));

    if (!awayFN || !homeFN) {
      const og = $hub('meta[property="og:title"]').attr('content') || '';
      [awayFN, homeFN] = namesFromOg(og);
    }

    awayAb = awayAb || deriveAbbr(awayFN);
    homeAb = homeAb || deriveAbbr(homeFN);

    const iso   = $hub('div.covers-CoversMatchupHub-GameInfo time').attr('datetime');
    const gDate = iso ? iso.split('T')[0] : null;

    // Single stats page contains both teams; choose TRUE/last3
    const statsUrl = `https://www.covers.com/sport/football/nfl/matchup/${id}/stats-analysis/TRUE/last3`;
    const statsRes = await AX.get(statsUrl);
    const $s       = load(statsRes.data);

    // Validate presence of the expected tables
    const hasStats   = $s('table.stats-table').length > 0;
    const hasAverages= $s('table.average-table').length > 0;
    if (!hasStats || !hasAverages) {
      const snippet = clean($s('body').text()).slice(0, 220);
      throw new Error(`Missing stats/average tables for ${id}. Snippet: ${snippet}`);
    }

    // Identify which table columns are the two teams
    const headers = [];
    $s('table.stats-table thead th').each((i, th) => headers.push(clean($s(th).text())));
    const homeCol = headers.findIndex(h => h && homeFN && h.includes(homeFN));
    const awayCol = headers.findIndex(h => h && awayFN && h.includes(awayFN));

    if (homeCol < 0 || awayCol < 0) {
      throw new Error(`Could not locate team columns on stats page for ${id}. Headers: ${JSON.stringify(headers)}`);
    }

    // Generic row readers (case-insensitive "startsWith")
    const findRow = (tableSel, labelLc) => {
      const rows = $s(`${tableSel} tbody tr`);
      let hit = null;
      rows.each((_, tr) => {
        const first = clean($s(tr).find('th,td').first().text()).toLowerCase();
        if (first.startsWith(labelLc)) hit = tr;
      });
      return hit;
    };

    const numberAt = (tr, colIndex) => {
      const td = $s(tr).find('td').eq(colIndex);
      const n  = parseFloat(clean(td.text()).replace(/[^\d.\-]/g, ''));
      if (!Number.isFinite(n)) throw new Error(`Bad number at col ${colIndex}: "${td.text()}"`);
      return n;
    };

    const L = {
      passYPA: 'pass yards / att',
      rushYPA: 'rush yards / att',
      tos:     'turnovers'
    };

    const rPickPass = findRow('table.stats-table',   L.passYPA);
    const rPickRush = findRow('table.stats-table',   L.rushYPA);
    const rPickTos  = findRow('table.stats-table',   L.tos);
    const rAvgPass  = findRow('table.average-table', L.passYPA);
    const rAvgRush  = findRow('table.average-table', L.rushYPA);
    const rAvgTos   = findRow('table.average-table', L.tos);

    if (!rPickPass || !rPickRush || !rPickTos || !rAvgPass || !rAvgRush || !rAvgTos) {
      throw new Error(`Expected rows missing for matchup ${id}`);
    }

    // Away
    const a_ypa_pick = numberAt(rPickPass, awayCol);
    const a_rpa_pick = numberAt(rPickRush, awayCol);
    const a_tos_pick = numberAt(rPickTos,  awayCol);

    const a_ypa_avg  = numberAt(rAvgPass,  awayCol);
    const a_rpa_avg  = numberAt(rAvgRush,  awayCol);
    const a_tos_avg  = numberAt(rAvgTos,   awayCol);

    // Home
    const h_ypa_pick = numberAt(rPickPass, homeCol);
    const h_rpa_pick = numberAt(rPickRush, homeCol);
    const h_tos_pick = numberAt(rPickTos,  homeCol);

    const h_ypa_avg  = numberAt(rAvgPass,  homeCol);
    const h_rpa_avg  = numberAt(rAvgRush,  homeCol);
    const h_tos_avg  = numberAt(rAvgTos,   homeCol);

    const awayRow = {
      covers_id : id,
      team_role : 'away',
      team_name : awayFN,
      team_abbr : awayAb,
      yp_pa_off : safeDivide(a_ypa_pick, a_ypa_avg),
      yp_ra_off : safeDivide(a_rpa_pick, a_rpa_avg),
      tov_off   : safeDivide(a_tos_avg,  a_tos_pick),
      yp_pa_def : safeDivide(a_ypa_avg,  a_ypa_pick),
      yp_ra_def : safeDivide(a_rpa_avg,  a_rpa_pick),
      tov_def   : safeDivide(a_tos_pick, a_tos_avg)
    };

    const homeRow = {
      covers_id : id,
      team_role : 'home',
      team_name : homeFN,
      team_abbr : homeAb,
      yp_pa_off : safeDivide(h_ypa_pick, h_ypa_avg),
      yp_ra_off : safeDivide(h_rpa_pick, h_rpa_avg),
      tov_off   : safeDivide(h_tos_avg,  h_tos_pick),
      yp_pa_def : safeDivide(h_ypa_avg,  h_ypa_pick),
      yp_ra_def : safeDivide(h_rpa_avg,  h_rpa_pick),
      tov_def   : safeDivide(h_tos_pick, h_tos_avg)
    };

    // Sanity: ensure we got real numbers
    const required = ['yp_pa_off','yp_ra_off','tov_off','yp_pa_def','yp_ra_def','tov_def'];
    for (const r of [awayRow, homeRow]) {
      for (const k of required) {
        if (r[k] == null || !Number.isFinite(r[k])) {
          throw new Error(`Metric ${k} is null/NaN for ${id} (${r.team_role})`);
        }
      }
    }

    return { rows: [awayRow, homeRow], gameDate: gDate, hubText };
  }

  /* ---------- Main run -------------------------------------------------- */
  const ids = await discoverMatchups();
  console.log(`⛏️  Found ${ids.length} matchups${DISCOVER_DATE ? ` for ${DISCOVER_DATE}` : ''}`);

  const bulk = [];
  const wrote = [];

  await Promise.all(
    ids.map(id => limit(async () => {
      try {
        const { rows, gameDate, hubText } = await scrapeMatchup(id);

        const home = rows.find(r => r.team_role === 'home');
        const away = rows.find(r => r.team_role === 'away');

        home.team_id = idFromNameOrAbbr(home.team_name, home.team_abbr, hubText);
        away.team_id = idFromNameOrAbbr(away.team_name, away.team_abbr, hubText);

        bulk.push(
          { ...home, team_abbr: undefined },
          { ...away, team_abbr: undefined }
        );

        await nfl.from('matchups').upsert({
          covers_id    : id,
          season       : SEASON,
          week         : WEEK,
          game_date    : gameDate,
          home_team    : home.team_name,
          away_team    : away.team_name,
          home_team_id : home.team_id,
          away_team_id : away.team_id
        }, { onConflict: 'covers_id' }).throwOnError();

        wrote.push(id);
        console.log(`✅ wrote matchup ${id}`);
      } catch (e) {
        if (DEBUG) console.error(e?.stack || e);
        else       console.error(String(e?.message || e));
        console.error(`❌ matchup ${id} failed`);
      }
    }))
  );

  if (bulk.length) {
    const { error: upErr } = await nfl
      .from('team_last3')
      .upsert(bulk, { onConflict: 'covers_id,team_role' });
    if (upErr) logPg(upErr);
    else console.log(`🚀 Upserted ${bulk.length} rows`);
  } else {
    console.error('⚠️  No rows to upsert (all matchups failed?)');
  }

  // Write a tiny artifact so the workflow can cat it
  try {
    const artifact = {
      season: SEASON, week: WEEK,
      count: wrote.length,
      ids: wrote.slice(0, 20)
    };
    fs.writeFileSync('scrape-result.json', JSON.stringify(artifact, null, 2));
  } catch { /* ignore */ }

  console.log('🎉 Done');
})();
