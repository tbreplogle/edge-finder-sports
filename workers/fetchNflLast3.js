/* eslint-disable no-console -------------------------------------------------*/
import axios from "axios";
import { load } from "cheerio";
import pLimit from "p-limit";
import { createClient } from "@supabase/supabase-js";
import util from 'util';
/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE;          // service‑role key
const sb     = createClient(SB_URL, SB_KEY, {
  auth: { persistSession: false }
});

const limit  = pLimit(8);          // don’t hammer Covers
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

  return [parseSide(awayHtml, "away"), parseSide(homeHtml, "home")];
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
          const rows = await scrapeMatchup(id);
          allRows.push(...rows);

          // basic matchup meta
          await sb.from("nfl.matchups")
            .upsert({
              covers_id: id,
              season:    SEASON,
              week:      WEEK,
              game_date: null,   // parse later if needed
              home_team: rows.find(r => r.team_role === "home").team_name,
              away_team: rows.find(r => r.team_role === "away").team_name
            }, { onConflict: "covers_id" })
            .throwOnError();

          console.log(`✅ ${id}`);
        } catch (err) {
            console.error(`❌ ${id}:`, util.inspect(err, { depth: 5, colors: false }));
          }
      })
    )
  );

  /* ── bulk write to team_last3 ─────────────────────────────────────────── */
  if (allRows.length) {
    try {
      const { data, error } = await sb
        .from('nfl.team_last3')
        .upsert(allRows, { onConflict: 'covers_id,team_role' })
        .select();                            // returns rows that actually wrote

      if (error) throw error;                // bubble real PG message
      console.log(`🚀 Upserted ${data.length} rows`);
    } catch (err) {
        console.error('🔥 Postgres threw:\n',
                      util.inspect(err, { depth: 5, colors: false }));
        process.exit(1);
      }
  }

  console.log('🎉 Done');
  process.exit(0);
})();

