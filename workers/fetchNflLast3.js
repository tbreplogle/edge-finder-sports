/* eslint-disable no-console -------------------------------------------------*/
import axios            from 'axios';
import { load }         from 'cheerio';
import pLimit           from 'p-limit';
import { createClient } from '@supabase/supabase-js';

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE;

const sb  = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const nfl = sb.schema('nfl');

const limit  = pLimit(16);
const SEASON = 2024;
const WEEK   = 17;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */
const logPgError = e => console.error(
  'STATUS:', e.status, '\nMESSAGE:', e.message,
  '\nDETAIL :', e.details, '\nHINT   :', e.hint, '\nCODE   :', e.code
);

const safeDivide = (n, d) => {
  const r = n / d;
  return Number.isFinite(r) ? r : d === 0 ? 4 : null;
};

const clean = s => s?.replace(/\u00A0/g, ' ').trim();   // strip NBSP

/* -------------------------------------------------------------------------- */
/*  Pre‑load team maps (name ➜ id, abbr ➜ id)                                 */
/* -------------------------------------------------------------------------- */
const { data: rows, error: mapErr } = await nfl
  .from('teams')
  .select('team_name,abbreviation,team_id');

if (mapErr) throw mapErr;

const NAME_MAP = Object.fromEntries(rows.map(r => [clean(r.team_name), r.team_id]));
const ABBR_MAP = Object.fromEntries(rows.map(r => [r.abbreviation.toUpperCase(), r.team_id]));

function idFromNameOrAbbr(name, abbr) {
  const tidyName = clean(name);
  if (NAME_MAP[tidyName]) return NAME_MAP[tidyName];

  const up = (abbr || '').toUpperCase();
  if (ABBR_MAP[up]) return ABBR_MAP[up];

  throw new Error(`Unmapped team: "${name}" / "${abbr}"`);
}

/* -------------------------------------------------------------------------- */
/*  0) Discover Covers matchup IDs                                            */
/* -------------------------------------------------------------------------- */
async function discoverMatchups () {
  const res = await axios.get('https://www.covers.com/sports/nfl/matchups');
  const $   = load(res.data);
  const ids = new Set();

  $("a[href*='/sport/football/nfl/matchup/']").each((_, el) => {
    const m = $(el).attr('href').match(/matchup\/(\d+)/);
    if (m) ids.add(+m[1]);
  });

  if (!ids.size) throw new Error('Covers markup changed — no matchup IDs');
  return [...ids];
}

/* -------------------------------------------------------------------------- */
/*  1) Scrape one matchup                                                     */
/* -------------------------------------------------------------------------- */
async function scrapeMatchup (coversId) {
  /* --- 1a hub page just for team names/abbrs & date --------------------- */
  const hubHtml = await axios.get(
    `https://www.covers.com/sport/football/nfl/matchup/${coversId}`
  );
  const $hub = load(hubHtml.data);

  const awayName = clean($hub('div.matchup-team.away-team span.matchup-team-name a').text());
  const homeName = clean($hub('div.matchup-team.home-team span.matchup-team-name a').text());
  const awayAbbr = clean($hub('div.matchup-team.away-team span.matchup-team-short-name').text());
  const homeAbbr = clean($hub('div.matchup-team.home-team span.matchup-team-short-name').text());

  const gameDateIso = $hub('div.covers-CoversMatchupHub-GameInfo time').attr('datetime');
  const gameDate = gameDateIso ? gameDateIso.split('T')[0] : null;

  /* --- 1b stats pages for last‑3 numbers -------------------------------- */
  const statsUrl = flag =>
    `https://www.covers.com/sport/football/nfl/matchup/${coversId}/stats-analysis/${flag}/last3`;

  const [awayHtml, homeHtml] = await Promise.all([
    axios.get(statsUrl('FALSE')),
    axios.get(statsUrl('TRUE'))
  ]);

  const parseSide = (html, role) => {
    const $ = load(html.data);
    const pick = (r, c) => +$('table.stats-table tbody tr').eq(r).find('td').eq(c).text().trim() || 0;
    const avg  = r      => +$('table.average-table tbody tr').eq(r).find('td').text().trim()   || 0;

    return {
      covers_id: coversId,
      team_role: role,
      team_name: role === 'home' ? homeName : awayName,
      team_abbr: role === 'home' ? homeAbbr : awayAbbr,
      yp_pa_off: safeDivide(pick(10, 0), avg(10)),
      yp_ra_off: safeDivide(pick(4, 0),  avg(4)),
      tov_off:   safeDivide(avg(2) + avg(3), pick(2, 0) + pick(3, 0)),
      yp_pa_def: safeDivide(avg(10), pick(10, 4)),
      yp_ra_def: safeDivide(avg(4),  pick(4, 4)),
      tov_def:   safeDivide(pick(2, 4) + pick(3, 4), avg(2) + avg(3))
    };
  };

  return {
    rows: [parseSide(awayHtml, 'away'), parseSide(homeHtml, 'home')],
    gameDate
  };
}

/* -------------------------------------------------------------------------- */
/*  2) Orchestrate & write                                                    */
/* -------------------------------------------------------------------------- */
(async () => {
  const ids = await discoverMatchups();
  console.log(`⛏️  Found ${ids.length} matchups for week ${WEEK}`);

  const allRows = [];

  await Promise.all(ids.map(id => limit(async () => {
    try {
      const { rows, gameDate } = await scrapeMatchup(id);

      const homeRow = rows.find(r => r.team_role === 'home');
      const awayRow = rows.find(r => r.team_role === 'away');

      homeRow.team_id = idFromNameOrAbbr(homeRow.team_name, homeRow.team_abbr);
      awayRow.team_id = idFromNameOrAbbr(awayRow.team_name, awayRow.team_abbr);

      allRows.push(homeRow, awayRow);

      await nfl.from('matchups').upsert({
        covers_id: id,
        season: SEASON,
        week: WEEK,
        game_date: gameDate,
        home_team_id: homeRow.team_id,
        away_team_id: awayRow.team_id
      }, { onConflict: 'covers_id' }).throwOnError();

      console.log(`✅ wrote matchup ${id}`);
    } catch (err) {
      logPgError(err);
      console.error(`❌ matchup ${id} failed`);
    }
  })));

  /* bulk write last‑3 ratios --------------------------------------------- */
  if (allRows.length) {
    try {
      const { data, error } = await nfl
        .from('team_last3')
        .upsert(allRows, { onConflict: 'covers_id,team_role' })
        .select();

      if (error) throw error;
      console.log(`🚀 Upserted ${data.length} rows`);
    } catch (err) {
      console.error('🔥 Postgres threw:');
      logPgError(err);
      process.exit(1);
    }
  }

  console.log('🎉 Done');
  process.exit(0);
})();
