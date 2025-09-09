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
const fs       = require('fs');
const axios    = require('axios');
const { load } = require('cheerio');

/* Browsery client – avoid anti-bot markup */
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
  validateStatus: s => s >= 200 && s < 400
});

(async () => {
  const { default: pLimit }  = await import('p-limit');
  const { createClient }     = await import('@supabase/supabase-js');

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false }
  });
  const nfl    = sb.schema('nfl');
  const limit  = pLimit(12);
  const SEASON = 2024;
  const WEEK   = 17;

  const DISCOVER_DATE = process.env.DISCOVER_DATE || null;
  const DEBUG = String(process.env.DEBUG || '').toLowerCase() === 'true';

  const clean = s => (s ?? '').replace(/\u00A0/g, ' ').trim();
  const sanitize = n => clean(n)
    .replace(/\s+Stats.*$/i, '')
    .replace(/\s+Team.*$/i, '')
    .replace(/\s+Football$/i, '');

  const safeDivide = (n, d) => d === 0 ? null : Number.isFinite(n / d) ? n / d : null;

  const logPg = e => console.error(
    'STATUS :',  e?.status,
    '\nMESSAGE:', e?.message,
    '\nDETAIL :', e?.details,
    '\nCODE   :', e?.code
  );

  /* ---------- Team dictionary ---------- */
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

    const cand = teams.filter(t => t.team_name.startsWith(name) && hubText.includes(t.alt_name));
    if (cand.length === 1) return cand[0].team_id;

    throw new Error(`Unmapped team: "${longName}" / "${abbr}"`);
  };

  const deriveAbbr = n => {
    if (!n) return '';
    const caps = n.match(/[A-Z]/g);
    return caps ? caps.slice(-3).join('').toUpperCase() : '';
  };

  /* ---------- Discover matchups ---------- */
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
      throw new Error(`No matchup IDs found. Possible anti-bot or markup change.\nBody snippet: ${snippet}`);
    }
    return [...ids];
  }

  const namesFromOg = title => {
    const parts = title.split(/\s+vs\.?\s+/i);
    if (parts.length < 2) return [null, null];
    const away = sanitize(parts[0]);
    const home = sanitize(parts[1].split(/\s(?:Odds|Picks|Predictions|Preview|Betting|-\s|\|\s)/i)[0]);
    return [away, home];
  };

  /* ---------- Robust numeric grabbers (header-agnostic) ---------- */
  const numsFromRowTds = ($, tr) => {
    const out = [];
    $(tr).find('td').each((_, td) => {
      const txt = clean($(td).text());
      const n = parseFloat(txt.replace(/[^\d.\-]/g, ''));
      if (Number.isFinite(n)) out.push(n);
    });
    return out;
  };

  // From a given table+label, get [away, home] numbers by heuristics
  function pickTwoNumbers ($, tableSel, labelLc, kind) {
    const rows = $(`${tableSel} tbody tr`);
    let hit = null;
    rows.each((_, tr) => {
      const first = clean($(tr).find('th,td').first().text()).toLowerCase();
      if (first.startsWith(labelLc)) hit = tr;
    });
    if (!hit) throw new Error(`Row "${labelLc}" not found in ${tableSel}`);

    const vals = numsFromRowTds($, hit);

    // Heuristic filters by metric type (keeps the two “stat” columns, ignores ranks)
    const plausible = (n) => {
      if (kind === 'ypa')  return n > 1 && n < 20;   // yards/att
      if (kind === 'tos')  return n >= 0 && n < 10;  // turnovers in last 3 avg
      return Number.isFinite(n);
    };
    const filtered = vals.filter(plausible);

    if (filtered.length < 2) {
      throw new Error(`Could not find two plausible ${kind} numbers (vals=${JSON.stringify(vals)})`);
    }

    // Use the first two plausible values as [away, home] – Covers lists road team first
    return [filtered[0], filtered[1]];
  }

  /* ---------- Scrape a single matchup ---------- */
  async function scrapeMatchup (id) {
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

    // Stats page (contains both teams), timeframe: last3
    const statsUrl = `https://www.covers.com/sport/football/nfl/matchup/${id}/stats-analysis/TRUE/last3`;
    const statsRes = await AX.get(statsUrl);
    const $s       = load(statsRes.data);

    if ($s('table.stats-table').length === 0 || $s('table.average-table').length === 0) {
      const snippet = clean($s('body').text()).slice(0, 220);
      throw new Error(`Missing stats/average tables for ${id}. Snippet: ${snippet}`);
    }

    const L = {
      passYPA: 'pass yards / att',
      rushYPA: 'rush yards / att',
      tos:     'turnovers'
    };

    // FROM stats-table (pick values) and average-table (league avg vs opp?) – we will compute ratios the same way you did:
    // offense ratios = pick / avg, defense ratios = avg / pick (and turnovers flipped)
    const [a_ypa_pick, h_ypa_pick] = pickTwoNumbers($s, 'table.stats-table',   L.passYPA, 'ypa');
    const [a_rpa_pick, h_rpa_pick] = pickTwoNumbers($s, 'table.stats-table',   L.rushYPA, 'ypa');
    const [a_tos_pick, h_tos_pick] = pickTwoNumbers($s, 'table.stats-table',   L.tos,     'tos');

    const [a_ypa_avg,  h_ypa_avg ] = pickTwoNumbers($s, 'table.average-table', L.passYPA, 'ypa');
    const [a_rpa_avg,  h_rpa_avg ] = pickTwoNumbers($s, 'table.average-table', L.rushYPA, 'ypa');
    const [a_tos_avg,  h_tos_avg ] = pickTwoNumbers($s, 'table.average-table', L.tos,     'tos');

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

  /* ---------- Main run ---------- */
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

        // strip abbr before upsert
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

  try {
    const artifact = { season: SEASON, week: WEEK, count: wrote.length, ids: wrote.slice(0, 20) };
    fs.writeFileSync('scrape-result.json', JSON.stringify(artifact, null, 2));
  } catch {}

  console.log('🎉 Done');
})();
