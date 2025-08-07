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
/*  Everything else runs in one async IIFE                                    */
/* -------------------------------------------------------------------------- */
(async () => {
  /* ----------- dynamic ESM-only deps ------------------------------------ */
  const { default: pLimit }  = await import('p-limit');
  const { createClient }     = await import('@supabase/supabase-js');

  /* ----------- Config --------------------------------------------------- */
  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE,
    { auth: { persistSession: false } }
  );

  const nfl    = sb.schema('nfl');
  const limit  = pLimit(16);
  const SEASON = 2024;          // flip in August
  const WEEK   = 17;            // soon dynamic

  /* ----------- Helpers -------------------------------------------------- */
  const clean    = s => s?.replace(/\u00A0/g, ' ').trim();
  const sanitize = n => clean(n)
    ?.replace(/\s+Stats.*$/i,  '')
    .replace(/\s+Team.*$/i,    '')
    .replace(/\s+Football$/i,  '');

  // **fixed** – no more hard-coded 4’s
  const safeDivide = (n, d) =>
    d === 0        ? null
    : !isFinite(n) ? null
    : n / d;

  const logPg = e => console.error(
    'STATUS :',  e.status,
    '\nMESSAGE:', e.message,
    '\nDETAIL :', e.details,
    '\nCODE   :', e.code
  );

  /* ----------- Team dictionary ----------------------------------------- */
  const { data: teams, error } = await nfl
    .from('teams')
    .select('team_id,team_name,abbreviation,alt_name');
  if (error) throw error;

  const NAME_MAP = Object.fromEntries(teams.map(t => [clean(t.team_name), t.team_id]));
  const ABBR_MAP = Object.fromEntries(teams.map(t => [t.abbreviation.toUpperCase(), t.team_id]));

  const idFromNameOrAbbr = (longName, abbr, hubText) => {
    const name = clean(longName);
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

  /* ----------- Discover matchup IDs ------------------------------------ */
  async function discoverMatchups () {
    const $ = load((await axios.get('https://www.covers.com/sports/nfl/matchups')).data);
    const ids = new Set();
    $("a[href*='/sport/football/nfl/matchup/']").each((_, el) => {
      const m = $(el).attr('href').match(/matchup\/(\d+)/);
      if (m) ids.add(+m[1]);
    });
    if (!ids.size) throw new Error('Covers markup changed — no matchup IDs found');
    return [...ids];
  }

  /* ----------- Parse og:title fallback ---------------------------------- */
  const namesFromOg = title => {
    const parts = title.split(/\s+vs\.?\s+/i);
    if (parts.length < 2) return [null, null];

    const away = sanitize(parts[0]);
    const home = sanitize(
      parts[1].split(/\s(?:Odds|Picks|Predictions|Preview|Betting|-\s|\|\s)/i)[0]
    );
    return [away, home];
  };

  /* ----------- Scrape ONE matchup -------------------------------------- */
  async function scrapeMatchup (id) {
    /* ---- hub page (team names / abbrs / date) ---- */
    const hub   = await axios.get(`https://www.covers.com/sport/football/nfl/matchup/${id}`);
    const $hub  = load(hub.data);
    const hubTx = $hub.text();

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

    /* ---- stats pages (same HTML structure as R script) ---- */
    const stats = f =>
      `https://www.covers.com/sport/football/nfl/matchup/${id}/stats-analysis/${f}/last3`;

    const [awayStats, homeStats] = await Promise.all([
      axios.get(stats('FALSE')),   // away team column on the left
      axios.get(stats('TRUE'))    // home team column on the left
    ]);

    /* ---- helper to build one side’s ratios (mirrors your R) ---- */
    const parseSide = (html, role) => {
      const $ = load(html.data);
      /* row numbers in the R script (zero-based) */
      const pick = (r, c) =>
        +$('table.stats-table tbody tr').eq(r).find('td').eq(c).text().trim() || 0;
      const avg  = r =>
        +$('table.average-table tbody tr').eq(r).find('td').text().trim() || 0;

      /*  R rows / cols
          ────────────────────────────────────────────────
          YPPA  row 10   | off col 0   | def col 4
          YPRA  row  4   | off col 0   | def col 4
          INT   row  2   | off col 0   | def col 4
          FUM   row  3   | off col 0   | def col 4
      */
      const ypPaPickOff = pick(10, 0);
      const ypRaPickOff = pick(4,  0);
      const intPickOff  = pick(2,  0);
      const fumPickOff  = pick(3,  0);

      const ypPaPickDef = pick(10, 4);
      const ypRaPickDef = pick(4,  4);
      const intPickDef  = pick(2,  4);
      const fumPickDef  = pick(3,  4);

      const ypPaAvg = avg(10);
      const ypRaAvg = avg(4);
      const intAvg  = avg(2);
      const fumAvg  = avg(3);

      return {
        covers_id : id,
        team_role : role,                          // 'home' | 'away'
        team_name : role === 'home' ? homeFN : awayFN,
        team_abbr : role === 'home' ? homeAb : awayAb,

        /* ---- OFFENCE ratios ---- */
        yp_pa_off : safeDivide(ypPaPickOff, ypPaAvg),
        yp_ra_off : safeDivide(ypRaPickOff, ypRaAvg),
        tov_off   : safeDivide(intAvg + fumAvg, intPickOff + fumPickOff),

        /* ---- DEFENCE ratios ---- */
        yp_pa_def : safeDivide(ypPaAvg, ypPaPickDef),
        yp_ra_def : safeDivide(ypRaAvg, ypRaPickDef),
        tov_def   : safeDivide(intPickDef + fumPickDef, intAvg + fumAvg)
      };
    };

    return {
      rows     : [parseSide(awayStats, 'away'), parseSide(homeStats, 'home')],
      gameDate : gDate,
      hubText  : hubTx
    };
  }

  /* ----------- Main run ------------------------------------------------- */
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

  /* ---- bulk-insert ratios --------------------------------------------- */
  if (bulk.length) {
    // team_last3 table has no team_abbr column
    const payload = bulk.map(({ team_abbr, ...rest }) => rest);

    const { error: upErr } = await nfl
      .from('team_last3')
      .upsert(payload, { onConflict: 'covers_id,team_role' });

    if (upErr) logPg(upErr);
    else       console.log(`🚀 Upserted ${payload.length} rows`);
  }

  console.log('🎉 Done');
})();
