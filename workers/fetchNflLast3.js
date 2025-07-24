/* eslint-disable no-console -------------------------------------------------*/
import axios           from 'axios';
import { load }        from 'cheerio';
import pLimit          from 'p-limit';
import { createClient } from '@supabase/supabase-js';
import util            from 'util';

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE;   // service‑role key

const sb  = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const nfl = sb.schema('nfl');

const limit  = pLimit(16);   // don’t hammer Covers
const SEASON = 2024;         // flip in August
const WEEK   = 17;           // will soon be dynamic

/* -------------------------------------------------------------------------- */
/*  Optional dynamic week (commented out)                                     */
/* -------------------------------------------------------------------------- */
/*
const { data: weeks } = await nfl
  .from('week_calendar')
  .select('week,start,finish')
  .eq('season', SEASON);

const today = new Date();
const todayWeek = weeks.find(w =>
  today >= new Date(w.start) && today <= new Date(w.finish)
)?.week;

console.log(`Today is NFL Week ${todayWeek}`);
*/

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */
const logPgError = err => {
  console.error('STATUS :', err.status);
  console.error('MESSAGE:', err.message);
  console.error('DETAIL :', err.details);
  console.error('HINT   :', err.hint);
  console.error('CODE   :', err.code);
};

const safeDivide = (num, den) => {
  const r = num / den;
  return Number.isFinite(r) ? r : den === 0 ? 4 : null;
};

/* -------------------------------------------------------------------------- */
/*  Team cache (name ➜ id)                                                    */
/* -------------------------------------------------------------------------- */
const teamCache = new Map();

async function nameToId (name) {
  if (teamCache.has(name)) return teamCache.get(name);

  const { data, error } = await nfl
    .from('teams')
    .select('team_id')
    .eq('team_name', name);

  if (error) throw error;
  if (!data.length) throw new Error(`Team not found: ${name}`);

  teamCache.set(name, data[0].team_id);
  return data[0].team_id;
}

/* -------------------------------------------------------------------------- */
/*  0) Discover all matchup IDs on Covers                                     */
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
/*  1) Scrape one matchup (returns rows + gameDate)                           */
/* -------------------------------------------------------------------------- */
async function scrapeMatchup (coversId) {
  const url = flag =>
    `https://www.covers.com/sport/football/nfl/matchup/${coversId}/stats-analysis/${flag}/last3`;

  const [awayHtml, homeHtml] = await Promise.all([
    axios.get(url('FALSE')),   // away stats on the left
    axios.get(url('TRUE'))     // home stats on the left
  ]);

  const getGameDate = $ => {
    const iso = $('div.covers-CoversMatchupHub-GameInfo time').attr('datetime');
    return iso ? iso.split('T')[0] : null;          // 'YYYY-MM-DD'
  };

  const parseSide = (html, role) => {
    const $ = load(html.data);

    const pick = (row, col) =>
      +$('table.stats-table.football-stats-table tbody tr')
        .eq(row).find('td').eq(col).text().trim() || 0;

    const avg = row =>
      +$('table.average-table tbody tr').eq(row).find('td').text().trim() || 0;

    return {
      covers_id: coversId,
      team_role: role,
      team_name: $('div.matchup-team.' +
                   (role === 'home' ? 'home-team' : 'away-team') +
                   ' span.matchup-team-name a').text().trim(),
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
    gameDate: getGameDate(load(homeHtml.data))
  };
}

/* -------------------------------------------------------------------------- */
/*  2) Orchestrate & write                                                    */
/* -------------------------------------------------------------------------- */
(async () => {
  const matchupIds = await discoverMatchups();
  console.log(`⛏️  Found ${matchupIds.length} matchups for week ${WEEK}`);

  const allRows = [];

  await Promise.all(
    matchupIds.map(id =>
      limit(async () => {
        try {
          const { rows, gameDate } = await scrapeMatchup(id);

          const homeRow = rows.find(r => r.team_role === 'home');
          const awayRow = rows.find(r => r.team_role === 'away');

          homeRow.team_id = await nameToId(homeRow.team_name);
          awayRow.team_id = await nameToId(awayRow.team_name);

          allRows.push(homeRow, awayRow);

          await nfl.from('matchups').upsert({
            covers_id: id,
            season:    SEASON,
            week:      WEEK,
            game_date: gameDate,
            home_team_id: homeRow.team_id,
            away_team_id: awayRow.team_id
          }, { onConflict: 'covers_id' }).throwOnError();

          console.log(`✅ wrote matchup ${id}`);
        } catch (err) {
          logPgError(err);
          console.error(`❌ matchup ${id} failed`);
        }
      })
    )
  );

  /* bulk write last‑3 ratios --------------------------------------------- */
  if (allRows.length) {
    try {
      const { data, error } = await nfl
        .from('team_last3')
        .upsert(allRows, { onConflict: 'covers_id,team_role' })
        .select();   // rows actually written

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