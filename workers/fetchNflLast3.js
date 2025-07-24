/* eslint-disable no-console */
import axios from "axios";
import { load } from "cheerio";
import pLimit from "p-limit";
import { createClient } from "@supabase/supabase-js";

const SB_URL  = process.env.SUPABASE_URL;
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE;
const limit   = pLimit(8);             // don’t melt Covers; tweak if needed
const sb      = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const SEASON  = 2024;                  // flip this in August
const WEEK    = 17;                     // ditto
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
/* 0) Discover ALL matchup IDs for the given week                             */
/* -------------------------------------------------------------------------- */
async function discoverMatchups () {
  const sbPage = await axios.get("https://www.covers.com/sports/nfl/matchups"); //:contentReference[oaicite:0]{index=0}
  const $      = load(sbPage.data);

  // Each matchup card carries a link …/matchup/<id>
  const ids = new Set();
  $("a[href*='/sport/football/nfl/matchup/']").each((_, el) => {
    const match = $(el).attr("href").match(/matchup\/(\d+)/);
    if (match) ids.add(+match[1]);
  });

  if (!ids.size) throw new Error("Covers markup changed – no matchup IDs found");
  return [...ids];
}

/* -------------------------------------------------------------------------- */
/* 1) Extract per‑team last‑3 ratios for one matchup                           */
/* -------------------------------------------------------------------------- */
async function scrapeMatchup (coversId) {
  const base = id => `https://www.covers.com/sport/football/nfl/matchup/${coversId}/stats-analysis/${id}/last3`;

  const [awayHtml, homeHtml] = await Promise.all([
    axios.get(base("FALSE")), // away stats on the left
    axios.get(base("TRUE"))   // home stats on the left
  ]);

  const parseSide = (html, role) => {
    const $ = load(html.data);

    const pick = (row, col) =>
      +$("table.stats-table.football-stats-table tbody tr").eq(row).find("td").eq(col).text().trim() || null;

    const avg  = row => +$("table.average-table tbody tr").eq(row).find("td").text().trim() || null;

    // Off ratios
    const ypPaOff = pick(10, 0) / avg(10);      // 11th row in zero‑index
    const ypRaOff = pick(4,  0) / avg(4);
    const tovOff  = (avg(2) + avg(3)) / (pick(2,0) + pick(3,0));

    // Def ratios (right‑hand column)
    const ypPaDef = avg(10) / pick(10, 4);
    const ypRaDef = avg(4)  / pick(4,  4);
    const tovDef  = (pick(2,4) + pick(3,4)) / (avg(2) + avg(3));

    // Team name from hero section
    const teamName = $("div.matchup-team." + (role === "home" ? "home-team" : "away-team") + " span.matchup-team-name a").text().trim();

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

  return [
    parseSide(awayHtml, "away"),
    parseSide(homeHtml, "home")
  ];
}

/* -------------------------------------------------------------------------- */
/* 2) Orchestrate and write to Supabase                                        */
/* -------------------------------------------------------------------------- */
(async () => {
  const matchupIds = await discoverMatchups();
  console.log(`⛏️  Found ${matchupIds.length} matchups for week ${WEEK}`);

  // Scrape with limited parallelism
  const allTeamRows = [];
  await Promise.all(
    matchupIds.map(id => limit(async () => {
      try {
        const rows = await scrapeMatchup(id);
        allTeamRows.push(...rows);

        // Basic matchup meta for reference
        await sb.from("nfl.matchups").upsert({
          covers_id: id,
          season:    SEASON,
          week:      WEEK,
          game_date: null,  // you can parse it later if you need the exact date
          home_team: rows.find(r => r.team_role === "home").team_name,
          away_team: rows.find(r => r.team_role === "away").team_name
        }, { onConflict: "covers_id" })
        .throwOnError();

        console.log(`✅ ${id}`);
      } catch (err) {
        console.error(`❌ ${id}: ${err.message}`);
      }
    }))
  );

  // Bulk insert the per‑team stats
  if (allTeamRows.length) {
    await sb.from("nfl.team_last3").upsert(allTeamRows, { onConflict: "covers_id,team_role" })
    .throwOnError();
    console.log(`🚀 Upserted ${allTeamRows.length} team rows`);
  }

  console.log("🎉 Done");
  process.exit(0);
})();
