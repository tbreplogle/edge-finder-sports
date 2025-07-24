//workers fetchnfllast3.js
/* eslint-disable no-console -------------------------------------------------*/
import axios from "axios";
import { load } from "cheerio";
import pLimit from "p-limit";
import { createClient } from "@supabase/supabase-js";
import util from 'util';

const logPgError = err => {
    console.error('STATUS :', err.status);
    console.error('MESSAGE:', err.message);
    console.error('DETAIL :', err.details);
    console.error('HINT   :', err.hint);
    console.error('CODE   :', err.code);
  };
  /* -------------------------------------------------------------------------- */
/*  Translate team_name ➜ team_id (memoised)                                  */
/* -------------------------------------------------------------------------- */
const teamCache = new Map();
async function nameToId(name) {
  if (teamCache.has(name)) return teamCache.get(name);

   const { data, error } = await nfl      // ← use the schema‑scoped client
    .from('teams')
    .select('team_id')
    .eq('team_name', name)
    .single();

  if (error) throw error;

  teamCache.set(name, data.team_id);
  return data.team_id;
}

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE;          // service‑role key
const sb     = createClient(SB_URL, SB_KEY, {
  auth: { persistSession: false }
});
// right after you create the Supabase client
const TEAM_MAP = Object.fromEntries(
    (await sb.schema('nfl')
             .from('teams')
             .select('team_name, team_id'))   // ← array result!
      .data.map(t => [t.team_name, t.team_id])
  );
const nfl = sb.schema('nfl');   // <-- add this
const limit  = pLimit(16);          // don’t hammer Covers
const SEASON = 2024;               // flip in August
const WEEK   = 17;                 // will soon be dynamic
/*const { data: weeks } = await sb
    .from('nfl.week_calendar')
    .select('week,start,finish')
    .eq('season', 2025);

const today = new Date();
const todayWeek = weeks.find(w =>
    today >= new Date(w.start) && today <= new Date(w.finish)
)?.week;

console.log(`Today is NFL Week ${todayWeek}`);
*/
/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */
const safeDivide = (num, den) => {
  const r = num / den;                                 // JS division
  return Number.isFinite(r) ? r            // normal ratio
       :  den === 0        ? 4             // cap Infinity at 4
       :                     null;         // NaN → null (Postgres friendly)
};

/* -------------------------------------------------------------------------- */
/* 0) Discover all matchup IDs on Covers                                       */
/* -------------------------------------------------------------------------- */
async function discoverMatchups() {
  const res = await axios.get("https://www.covers.com/sports/nfl/matchups");
  const $   = load(res.data);

  const ids = new Set();
  $("a[href*='/sport/football/nfl/matchup/']").each((_, el) => {
    const m = $(el).attr("href").match(/matchup\/(\d+)/);
    if (m) ids.add(+m[1]);
  });

  if (!ids.size) throw new Error("Covers markup changed — no matchup IDs");
  return [...ids];
}

/* -------------------------------------------------------------------------- */
/* 1) Parse one matchup (home + away rows)                                     */
/* -------------------------------------------------------------------------- */
async function scrapeMatchup(coversId) {
  const url = flag =>
    `https://www.covers.com/sport/football/nfl/matchup/${coversId}/stats-analysis/${flag}/last3`;

    // helper lives OUTSIDE parseSide now
    const getGameDate = html => {
      const iso = html('div.covers-CoversMatchupHub-GameInfo time').attr('datetime');
      return iso ? iso.split('T')[0] : null;          // '2025‑01‑04'
    };
  const [awayHtml, homeHtml] = await Promise.all([
    axios.get(url("FALSE")),    // away stats on the left
    axios.get(url("TRUE"))      // home stats on the left
  ]);
  

  const parseSide = (html, role) => {
    const $ = load(html.data);

    const pick = (row, col) =>
      +$("table.stats-table.football-stats-table tbody tr")
        .eq(row).find("td").eq(col).text().trim() || 0;

    const avg = row =>
      +$("table.average-table tbody tr").eq(row).find("td").text().trim() || 0;
    const getGameDate = $ => {
        // Covers wraps it in <time datetime="2025-01-04T18:15:00Z">
        const iso = $('div.covers-CoversMatchupHub-GameInfo time').attr('datetime');
        return iso ? iso.split('T')[0] : null;   // '2025-01-04'
      };
    // Ratios (last‑3 vs league average)
    const ypPaOff = safeDivide(pick(10, 0), avg(10));
    const ypRaOff = safeDivide(pick(4, 0),  avg(4));
    const tovOff  = safeDivide(avg(2) + avg(3), pick(2, 0) + pick(3, 0));

    const ypPaDef = safeDivide(avg(10), pick(10, 4));
    const ypRaDef = safeDivide(avg(4),  pick(4, 4));
    const tovDef  = safeDivide(pick(2, 4) + pick(3, 4), avg(2) + avg(3));

    const teamName = $(
      `div.matchup-team.${role === "home" ? "home-team" : "away-team"}`
      + " span.matchup-team-name a"
    ).text().trim();

    return {
      covers_id: coversId,
      team_role: role,
      team_name: teamName,
      yp_pa_off: ypPaOff,
      yp_ra_off: ypRaOff,
      tov_off:   tovOff,
      yp_pa_def: ypPaDef,
      yp_ra_def: ypRaDef,
      tov_def:   tovDef
    };
  };
  const gameDate = getGameDate(load(homeHtml.data));   // same for awayHtml

    return {
        rows: [parseSide(awayHtml, 'away'), parseSide(homeHtml, 'home')],
        gameDate
      };
}

/* -------------------------------------------------------------------------- */
/* 2) Orchestrate & write                                                      */
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

            // look up team IDs once
            const homeRow = rows.find(r => r.team_role === 'home');
            const awayRow = rows.find(r => r.team_role === 'away');
            const homeId  = await nameToId(homeRow.team_name);
            const awayId  = await nameToId(awayRow.team_name);
            
            // attach IDs so they can write to nfl.team_last3
            homeRow.team_id = homeId;
            awayRow.team_id = awayId;
            allRows.push(homeRow, awayRow);
            // write matchup meta
            await nfl.from('matchups').upsert({
              covers_id: id,
              season:    SEASON,
              week:      WEEK,
              game_date: gameDate,
                home_team_id: TEAM_MAP[ rows.find(r => r.team_role === 'home').team_name ],
                away_team_id: TEAM_MAP[ rows.find(r => r.team_role === 'away').team_name ],
            }, { onConflict: 'covers_id' }).throwOnError();
            
            console.log(`✅ wrote matchup ${id}`);
            
        } catch (err) {
            logPgError(err);
            console.error(`❌ matchup ${id} failed`);

          }
      })
    )
  );

  /* ── bulk write to team_last3 ─────────────────────────────────────────── */
  if (allRows.length) {
    try {
         const { data, error } = await nfl
           .from('team_last3')
        .upsert(allRows, { onConflict: 'covers_id,team_id' })
        .select();                            // returns rows that actually wrote

      if (error) throw error;                // bubble real PG message
      console.log(`🚀 Upserted ${data.length} rows`);
    } catch (err) {
        console.error('🔥 Postgres threw:\n',
            logPgError(err)
        );
        process.exit(1);
      }
  }

  console.log('🎉 Done');
  process.exit(0);
})();

