/* -------------------------------------------------------------------------- */
/*  Polyfill for File (needed by undici on Node ≤ 18)                         */
/* -------------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------------- */
/*  CJS-friendly static imports                                               */
/* -------------------------------------------------------------------------- */
const axios    = require('axios');
const { load } = require('cheerio');

/* -------------------------------------------------------------------------- */
/*  Main body – EVERYTHING else sits inside one async IIFE                    */
/* -------------------------------------------------------------------------- */
(async () => {
  /* ---------- dynamic ESM-only deps ------------------------------------- */
  const { default: pLimit }  = await import('p-limit');
  const { createClient }     = await import('@supabase/supabase-js');

  /* ---------- Config ---------------------------------------------------- */
  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE,
    { auth: { persistSession: false } }
  );

  const nfl    = sb.schema('nfl');
  const limit  = pLimit(16);
  const SEASON = 2024;          // flip in August
  const WEEK   = 17;            // soon dynamic

  /*  If you want to scrape a specific “matchups?selectedDate=YYYY-MM-DD”
      page (handy for testing historic weeks), set DISCOVER_DATE.
      eg:  DISCOVER_DATE=2024-12-31 node fetchNflLast3.cjs                */
  const DISCOVER_DATE = process.env.DISCOVER_DATE || null;

  /* ---------- Helpers --------------------------------------------------- */
  const clean    = s => s?.replace(/\u00A0/g, ' ').trim();
  const sanitize = n => clean(n)
    ?.replace(/\s+Stats.*$/i,  '')        // ← wipes the long suffixes
    .replace(/\s+Team.*$/i,    '')
    .replace(/\s+Football$/i,  '');

  const safeDivide = (n, d) =>
    d === 0 ? null               // or NaN if you prefer
    : Number.isFinite(n / d) ? n / d
    : null;

  const logPg = e => console.error(
    'STATUS :',  e.status,
    '\nMESSAGE:', e.message,
    '\nDETAIL :', e.details,
    '\nCODE   :', e.code
  );

  /* ---------- Team dictionary ------------------------------------------- */
  const { data: teams, error } = await nfl
    .from('teams')
    .select('team_id,team_name,abbreviation,alt_name');
  if (error) throw error;

  const NAME_MAP = Object.fromEntries(teams.map(t => [sanitize(t.team_name), t.team_id]));
  const ABBR_MAP = Object.fromEntries(teams.map(t => [t.abbreviation.toUpperCase(), t.team_id]));

  const idFromNameOrAbbr = (longName, abbr, hubText) => {
    const name = sanitize(longName);              // ← was clean()
    if (NAME_MAP[name]) return NAME_MAP[name];

    const up = (abbr || '').toUpperCase();
    if (ABBR_MAP[up]) return ABBR_MAP[up];

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

  /* ---------- Discover matchup IDs -------------------------------------- */
  async function discoverMatchups () {
    const url = DISCOVER_DATE
      ? `https://www.covers.com/sports/nfl/matchups?selectedDate=${DISCOVER_DATE}`
      : 'https://www.covers.com/sports/nfl/matchups';

    const $ = load((await axios.get(url)).data);
    const ids = new Set();
    $("a[href*='/sport/football/nfl/matchup/']").each((_, el) => {
      const m = $(el).attr('href').match(/matchup\/(\d+)/);
      if (m) ids.add(+m[1]);
    });
    if (!ids.size) throw new Error('Covers markup changed — no matchup IDs');
    return [...ids];
  }

  /* ---------- Parse og:title helper ------------------------------------- */
  const namesFromOg = title => {
    const parts = title.split(/\s+vs\.?\s+/i);
    if (parts.length < 2) return [null, null];

    const away = sanitize(parts[0]);
    const home = sanitize(
      parts[1].split(/\s(?:Odds|Picks|Predictions|Preview|Betting|-\s|\|\s)/i)[0]
    );
    return [away, home];
  };

  /* ---------- Scrape a single matchup ----------------------------------- */
  async function scrapeMatchup (id) {
    const hubHtml = await axios.get(
      `https://www.covers.com/sport/football/nfl/matchup/${id}`
    );
    const $hub    = load(hubHtml.data);
    const hubText = $hub.text();

    let awayFN = sanitize($hub('div.matchup-team.away-team').attr('data-team-fullname'));
    let homeFN = sanitize($hub('div.matchup-team.home-team').attr('data-team-fullname'));
    let awayAb = sanitize($hub('div.matchup-team.away-team').attr('data-team-abbrev'));
    let homeAb = sanitize($hub('div.matchup-team.home-team').attr('data-team-abbrev'));

    if (!awayFN || !homeFN) {
      const og = $hub('meta[property="og:title"]').attr('content') || '';
      [awayFN, homeFN] = namesFromOg(og);
    }

    awayAb = awayAb || deriveAbbr(awayFN);
    homeAb = homeAb || deriveAbbr(homeFN);

    const iso   = $hub('div.covers-CoversMatchupHub-GameInfo time').attr('datetime');
    const gDate = iso ? iso.split('T')[0] : null;

    const stats = f =>
      `https://www.covers.com/sport/football/nfl/matchup/${id}/stats-analysis/${f}/last3`;

    const [awayStats, homeStats] = await Promise.all([
      axios.get(stats('FALSE')),
      axios.get(stats('TRUE'))
    ]);

    /* ---------- parseSide helper ---------------------------------------- */
    const parseSide = (html, role) => {
      const $ = load(html.data);

      const cellVal = label =>
        +$('table.stats-table tbody tr')
            .filter((_, tr) => $(tr).text().trim().startsWith(label))
            .find('td')
            .eq(role === 'home' ? 0 : 4)
            .text().trim() || 0;

      const avgVal = label =>
        +$('table.average-table tbody tr')
            .filter((_, tr) => $(tr).text().trim().startsWith(label))
            .find('td')
            .text().trim() || 0;

      const yp_pa_pick = cellVal('Pass Yards / Att');
      const yp_ra_pick = cellVal('Rush Yards / Att');
      const tos_pick   = cellVal('Turnovers');

      const yp_pa_avg  = avgVal('Pass Yards / Att');
      const yp_ra_avg  = avgVal('Rush Yards / Att');
      const tos_avg    = avgVal('Turnovers');

      return {
        covers_id : id,
        team_role : role,
        team_name : role === 'home' ? homeFN : awayFN,   // already sanitized
        team_abbr : role === 'home' ? homeAb : awayAb,

        yp_pa_off : safeDivide(yp_pa_pick, yp_pa_avg),
        yp_ra_off : safeDivide(yp_ra_pick, yp_ra_avg),
        tov_off   : safeDivide(tos_avg,    tos_pick),

        yp_pa_def : safeDivide(yp_pa_avg,  yp_pa_pick),
        yp_ra_def : safeDivide(yp_ra_avg,  yp_ra_pick),
        tov_def   : safeDivide(tos_pick,   tos_avg)
      };
    };

    return {
      rows     : [parseSide(awayStats, 'away'), parseSide(homeStats, 'home')],
      gameDate : gDate,
      hubText
    };
  }

  /* ---------- Main run --------------------------------------------------- */
  const ids = await discoverMatchups();
  console.log(`⛏️  Found ${ids.length} matchups for week ${WEEK}`);

  const bulk = [];

  await Promise.all(
    ids.map(id => limit(async () => {
      try {
        const { rows, gameDate, hubText } = await scrapeMatchup(id);

        const home = rows.find(r => r.team_role === 'home');
        const away = rows.find(r => r.team_role === 'away');

        home.team_id = idFromNameOrAbbr(home.team_name, home.team_abbr, hubText);
        away.team_id = idFromNameOrAbbr(away.team_name, away.team_abbr, hubText);

        bulk.push(home, away);

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

        console.log(`✅ wrote matchup ${id}`);
      } catch (e) {
        logPg(e);
        console.error(`❌ matchup ${id} failed`);
      }
    }))
  );

  if (bulk.length) {
    const payload = bulk.map(({ team_abbr, ...rest }) => rest); // strip abbr
    const { error: upErr } = await nfl
      .from('team_last3')
      .upsert(payload, { onConflict: 'covers_id,team_role' });
    if (upErr) logPg(upErr);
    else console.log(`🚀 Upserted ${payload.length} rows`);
  }

  console.log('🎉 Done');
})();
