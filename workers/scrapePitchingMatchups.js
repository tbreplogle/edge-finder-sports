// workers/scrapePitchingMatchups.js
import puppeteer from "puppeteer";
import {
  supabase,
  testConnection,
  createScrapeReport,
} from "./lib/supabaseClient.js";

const DEBUG = process.env.DEBUG === "true";

// Map from Covers team label → your team_id
const TEAM_ALT_NAME_TO_ID = {
  SEATTLE: 1,
  CLEVELAND: 2,
  PITTSBURGH: 3,
  "LA ANGELS": 4,
  TORONTO: 5,
  MIAMI: 6,
  ATHLETICS: 7,
  "NY YANKEES": 8,
  "TAMPA BAY": 9,
  MINNESOTA: 10,
  "KANSAS CITY": 11,
  "SF GIANTS": 12,
  "SAN FRANCISCO": 12,
  ARIZONA: 13,
  MILWAUKEE: 14,
  "CHI. WHITE SOX": 15,
  "CHI. CUBS": 16,
  ATLANTA: 17,
  "SAN DIEGO": 18,
  HOUSTON: 19,
  "NY METS": 20,
  "LA DODGERS": 21,
  COLORADO: 22,
  CINCINNATI: 23,
  WASHINGTON: 24,
  DETROIT: 25,
  PHILADELPHIA: 26,
  "ST. LOUIS": 27,
  TEXAS: 28,
  BOSTON: 29,
  BALTIMORE: 30,
};

async function scrapePitchingMatchups() {
  // 1) fetch today's market‐odds rows
  const today = new Date().toISOString().slice(0, 10);
  const { data: games, error: gamesErr } = await supabase
    .from("mlb_market_odds")
    .select("matchup_id, game_id")
    .eq("game_date", today);

  if (gamesErr) throw new Error(`Could not load games: ${gamesErr.message}`);
  if (!games || games.length === 0) {
    console.warn("⚠️  No games with market odds found for today");
    return [];
  }

  // 2) dedupe on game_id+matchup_id so you keep double-headers separate
  const uniqueGames = Array.from(
    new Map(games.map((g) => [`${g.matchup_id}:${g.game_id}`, g])).values()
  );
  console.log(
    `→ Found ${games.length} odds-rows, ${uniqueGames.length} unique games`
  );

  // 3) launch puppeteer
  const browser = await puppeteer.launch({
    headless: "new",
    channel: "chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  const rows = [];

  for (const { matchup_id, game_id } of uniqueGames) {
    const url = `https://www.covers.com/sport/baseball/mlb/matchup/${matchup_id}`;
    console.log(`→ Scraping ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForTimeout(2000);

    // identify away/home tabs
    for (const role of ["away", "home"]) {
      let teamLabel = null,
        team_id = null,
        pitcher_name = null;

      //  a) read team name from the tab
      try {
        teamLabel = await page.$eval(
          `a[href="#${role}-team-last-5"]`,
          (el) => el.textContent.trim().toUpperCase()
        );
        team_id = TEAM_ALT_NAME_TO_ID[teamLabel] || null;
      } catch {
        console.warn(`⚠️  Could not read team label for ${role} of ${matchup_id}`);
      }

      //  b) read pitcher name
      try {
        pitcher_name = await page.$eval(
          `#${role}-team-last-5 a.anchor-with-border`,
          (el) => el.textContent.trim()
        );
      } catch {
        console.warn(`⚠️  Could not read ${role} pitcher for matchup ${matchup_id}`);
      }

      //  c) attempt to scrape the "last 5 avg" row
      let stats = {};
      try {
        const tr = await page.$$eval(
          `#${role}-team-last-5 table tr`,
          (rows) =>
            rows
              .map((r) => Array.from(r.querySelectorAll("td b")).map((b) => b.textContent.trim()))
              .find((cells) => cells[0]?.toLowerCase().includes("last") && cells.length >= 11)
        );
        if (tr) {
          const [, ip_s, h_s, r_s, er_s, so_s, bb_s, hr_s, pit_s, pip_s, gbfb_s] = tr;
          stats = {
            ip: parseFloat(ip_s) || null,
            h: parseFloat(h_s) || null,
            r: parseFloat(r_s) || null,
            er: parseFloat(er_s) || null,
            so: parseFloat(so_s) || null,
            bb: parseFloat(bb_s) || null,
            hr: parseFloat(hr_s) || null,
            pit: parseFloat(pit_s) || null,
            pip: parseFloat(pip_s) || null,
            gbfb: parseFloat(gbfb_s) || null,
          };
        } else {
          console.warn(`⚠️  Unexpected stats format for ${role} (${matchup_id})`);
        }
      } catch (e) {
        console.warn(`⚠️  Error parsing stats for ${role} (${matchup_id}):`, e.message);
      }

      rows.push({
        game_id,
        matchup_id,
        pitcher_role: role,
        team_name: teamLabel,
        team_id,
        pitcher_name,
        // spread in whatever made it or `null`
        ...stats,
      });
    }
  }

  await browser.close();
  console.log(`→ Scraped ${rows.length} pitcher records`);
  return rows;
}

export async function scrapeAndSavePitchingMatchups() {
  console.log("⏳ Starting pitching-matchups scraper…");
  if (!(await testConnection())) process.exit(1);

  try {
    const rows = await scrapePitchingMatchups();
    if (!rows.length) throw new Error("No pitching stats found");

    console.log(`→ Upserting ${rows.length} rows to Supabase…`);
    const { data, error } = await supabase
      .from("pitching_matchups")
      .upsert(rows, { onConflict: ["matchup_id", "game_id", "pitcher_role"] })
      .select();

    if (error) throw error;
    console.log(`✅ Saved ${data.length} pitching records`);
    await createScrapeReport({ success: true, stats: { records: data.length } });
  } catch (err) {
    console.error("❌ Error inserting pitching stats:", err.message);
    await createScrapeReport({ success: false, error: err.message, stats: { records: 0 } });
  }
}

if (import.meta.url.endsWith("scrapePitchingMatchups.js")) {
  scrapeAndSavePitchingMatchups()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
