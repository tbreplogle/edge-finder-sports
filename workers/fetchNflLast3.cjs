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
  /* -------- dynamic ESM-only deps --------------------------------------- */
  const { default: pLimit }   = await import('p-limit');
  const { createClient }      = await import('@supabase/supabase-js');

  /* -------- Config ------------------------------------------------------ */
  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE,
    { auth: { persistSession: false } }
  );

  const nfl   = sb.schema('nfl');
  const limit = pLimit(16);

  const SEASON = 2024;
  const WEEK   = 17;               /* ← soon dynamic */

  /* -------- Helpers ----------------------------------------------------- */
  const clean    = s => s?.replace(/\u00A0/g, ' ').trim();
  const sanitize = n => clean(n)
    ?.replace(/\s+Stats.*$/i,  '')
    .replace(/\s+Team.*$/i,    '')
    .replace(/\s+Football$/i,  '');

  const safeDivide = (n, d) =>
    !isFinite(n) || !isFinite(d) || d === 0 ? null : n / d;

  const logPg = e => console.error(
    'STATUS :',  e.status,
    '\nMESSAGE:', e.message,
    '\nDETAIL :', e.details,
    '\nCODE   :', e.code
  );

  /* -------- Team dictionary -------------------------------------------- */
  const { data: teams, error } = await nfl
    .from('teams')
    .select('team_id,team_name,abbreviation,alt_name');
  if (error) throw error;

  const NAME_MAP = Object.fromEntries(teams.map(t => [clean(t.team_name), t.team_id]));
  const ABBR_MAP = Object.fromEntries(teams.map(t => [t.abbreviation.toUpperCase(), t.team_id]));

    const idFromNameOrAbbr = (longName, abbr, hubText) => {
        // strip “Stats & Past Results – NFL Game on …” etc. FIRST 👇
        const name = sanitize(longName);      //  <-- was clean(longName)
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

  /* -------- Discover matchup IDs --------------------------------------- */
  async function discoverMatchups () {
    const q = nfl
      .from('matchups')
      .select('covers_id')
      .eq('season', SEASON);
  
    if (WEEK != null) q.eq('week', WEEK);      // comment-out if you want full season
  
    const { data, error } = await q;
    if (error) throw error;
  
    const ids = data.map(r => r.covers_id).filter(Boolean);
    if (!ids.length) throw new Error(
      `No matchup rows found for season ${SEASON}` +
      (WEEK != null ? `, week ${WEEK}` : '')
    );
    return ids;
  }

  /* -------- Scrape ONE matchup ----------------------------------------- */
  async function scrapeMatchup (id) {
    /* hub page */
    const hub = await axios.get(`https://www.covers.com/sport/football/nfl/matchup/${id}`);
    const $H  = load(hub.data);
    const hubText = $H.text();

    let awayFN = sanitize($H('div.matchup-team.away-team').attr('data-team-fullname'));
    let homeFN = sanitize($H('div.matchup-team.home-team').attr('data-team-fullname'));
    let awayAb = sanitize($H('div.matchup-team.away-team').attr('data-team-abbrev'));
    let homeAb = sanitize($H('div.matchup-team.home-team').attr('data-team-abbrev'));

    /* fallback: og:title */
    if (!awayFN || !homeFN) {
      const og = $H('meta[property="og:title"]').attr('content') || '';
      const parts = og.split(/\s+vs\.?\s+/i);
      [awayFN, homeFN] = parts.length >= 2 ? parts : [null, null];
    }

    awayAb = awayAb || deriveAbbr(awayFN);
    homeAb = homeAb || deriveAbbr(homeFN);

    const iso   = $H('div.covers-CoversMatchupHub-GameInfo time').attr('datetime');
    const gDate = iso ? iso.split('T')[0] : null;

    /* stats pages */
    const stats = f =>
      `https://www.covers.com/sport/football/nfl/matchup/${id}/stats-analysis/${f}/last3`;

    const [awayStats, homeStats] = await Promise.all([
      axios.get(stats('FALSE')),
      axios.get(stats('TRUE'))
    ]);

    /* ---- label helpers ------------------------------------------------- */
    const norm = txt =>
      txt.toLowerCase()
         .replace(/\s+/g,  '')      /* remove spaces */
         .replace(/yards|yds/g, '') /* yards/yds → '' */
         .replace(/[^\w/]/g, '');   /* drop punctuation */

    const WANT = {
      passYPA : ['passyards/att', 'passyds/att'],
      rushYPA : ['rushyards/att', 'rushyds/att'],
      turnovers: ['turnovers']
    };

    const collectStats = (html, role) => {
      const $ = load(html.data);

      /* scan rows once – map label -> row element ------------------------ */
      const rowMap = {};
      $('table.stats-table tbody tr').each((_, tr) => {
        const label = norm($(tr).find('th,td').first().text());
        Object.values(WANT).forEach(keys => {
          if (keys.includes(label)) rowMap[label] = $(tr);
        });
      });

      /* helper to pull col by role (0 = left team, 4 = opp) -------------- */
      const colIdxThis = role === 'home' ? 0 : 0;     // this team’s col
      const colIdxOpp  = role === 'home' ? 4 : 4;     // opponent col

      const pick = (labArr, col) => {
        const row = rowMap[labArr.find(k => rowMap[k])];
        return row ? +row.find('td').eq(col).text().trim() || 0 : null;
      };

      /* averages table has one numeric <td> per row ---------------------- */
      const avg = labArr => {
        const tr = $('table.average-table tbody tr')
          .filter((_, r) => labArr.some(k => norm($(r).text()).startsWith(k)))
          .first();
        return tr.length ? +tr.find('td').text().trim() || 0 : null;
      };

      /* pull the six raw numbers we need --------------------------------- */
      const passPickOff = pick(WANT.passYPA, colIdxThis);
      const rushPickOff = pick(WANT.rushYPA, colIdxThis);
      const toPickOff   = pick(WANT.turnovers, colIdxThis);

      const passPickDef = pick(WANT.passYPA, colIdxOpp);
      const rushPickDef = pick(WANT.rushYPA, colIdxOpp);
      const toPickDef   = pick(WANT.turnovers, colIdxOpp);

      const passAvg = avg(WANT.passYPA);
      const rushAvg = avg(WANT.rushYPA);
      const toAvg   = avg(WANT.turnovers);

      /* tiny debug: warn once if something missing ----------------------- */
      const missing = [passPickOff, rushPickOff, toPickOff,
                       passPickDef, rushPickDef, toPickDef,
                       passAvg, rushAvg, toAvg].some(v => v === null);
      if (missing && collectStats._warned < 5) {
        console.warn(`⚠️  unmatched label(s) for matchup ${id} (${role})`);
        collectStats._warned = (collectStats._warned || 0) + 1;
      }

      return {
        covers_id : id,
        team_role : role,
        team_name : role === 'home' ? homeFN : awayFN,
        team_abbr : role === 'home' ? homeAb : awayAb,

        yp_pa_off : safeDivide(passPickOff, passAvg),
        yp_ra_off : safeDivide(rushPickOff, rushAvg),
        tov_off   : safeDivide(toAvg, toPickOff),

        yp_pa_def : safeDivide(passAvg, passPickDef),
        yp_ra_def : safeDivide(rushAvg, rushPickDef),
        tov_def   : safeDivide(toPickDef, toAvg)
      };
    };

    return {
      rows     : [collectStats(awayStats, 'away'), collectStats(homeStats, 'home')],
      gameDate : gDate,
      hubText
    };
  }

  /* -------- Main run ---------------------------------------------------- */
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

  /* bulk-insert ratios --------------------------------------------------- */
  if (bulk.length) {
    const payload = bulk.map(({ team_abbr, ...rest }) => rest);
    const { error: upErr } = await nfl
      .from('team_last3')
      .upsert(payload, { onConflict: 'covers_id,team_role' });

    if (upErr) logPg(upErr);
    else       console.log(`🚀 Upserted ${payload.length} rows`);
  }

  console.log('🎉 Done');
})();
