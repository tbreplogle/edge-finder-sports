// workers/scrapePitchingMatchups.js
import puppeteer from "puppeteer";
import {
  supabase,
  testConnection,
  createScrapeReport,
} from "./lib/supabaseClient.js";

const DEBUG = process.env.DEBUG === "true";

/** Covers tab text → team_id (matches teams_mlb.alt_name) */
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
  // 1) pull today’s games FROM mlb_market_odds
  const today = new Date().toISOString().slice(0, 10);
  const { data: games, error } = await supabase
    .from("mlb_market_odds")
    .select("matchup_id, game_id")
    .eq("game_date", today);

  if (error) throw new Error(`Could not load games: ${error.message}`);
  if (!games || games.length === 0) {
    console.warn("⚠️ No games with market odds found for today");
    return [];
  }

  // dedupe by game_id (not matchup_id) so each doubleheader stays distinct
  const uniqueGames = Array.from(
    new Map(games.map((g) => [g.game_id, g])).values()
  );
  console.log(`→ Found ${games.length} rows, ${uniqueGames.length} unique game_ids`);

  // 2) launch Puppeteer
  const browser = await puppeteer.launch({
    headless: "new",
    channel: "chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
  );

  const rows = [];

  // 3) loop through each unique game
  for (const { matchup_id, game_id } of uniqueGames) {
    const url = `https://www.covers.com/sport/baseball/mlb/matchup/${matchup_id}`;
    console.log(`→ Scraping ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // for each side (away / home) look at its table
    for (const role of ["away", "home"]) {
      const tabSelector = role === "away"
        ? 'a[href="#away-team-last-5"]'
        : 'a[href="#home-team-last-5"]';

      // click tab
      try {
        await page.click(tabSelector);
        await page.waitForSelector("table.starter-table", { timeout: 30000 });
      } catch {
        console.warn(`⚠️ Could not open ${role} tab for matchup ${matchup_id}`);
        continue;
      }

      // team name → id
      let team_name = null, team_id = null;
      try {
        team_name = await page.$eval(
          `${tabSelector} + .table-container .starter-table caption`,
          (c) => {
            // caption is always "Last 5" so back up: look at the first <a> in the table
            const link = c.parentElement!.querySelector("tbody tr:first-child a");
            return link?.textContent?.trim().split(" ")[0].toUpperCase() || "";
          }
        );
        team_id = TEAM_ALT_NAME_TO_ID[team_name] || null;
        if (!team_id) console.warn(`⚠️ No team_id mapping for "${team_name}"`);
      } catch {
        console.warn(`⚠️ Could not read ${role} team for matchup ${matchup_id}`);
      }

      // now grab the LAST ROW of tbody
      const allRows = await page.$$(
        `${tabSelector} + .table-container table.starter-table tbody tr`
      );
      if (allRows.length === 0) {
        console.warn(`⚠️ No rows in table for ${role} ${matchup_id}`);
        continue;
      }
      const avgRowHandle = allRows[allRows.length - 1];

      // extract all <b>…</b> cells (the 1st b is the "Last 5 Avg." label, then 12 numeric)
      const bTexts = await avgRowHandle.$$eval("b", (bs) =>
        bs.map((b) => b.textContent?.trim() || "")
      );
      if (bTexts.length < 13) {
        console.warn(`⚠️ Unexpected # cols (${bTexts.length}) for ${role} ${matchup_id}`);
        continue;
      }
      // drop first (label), then parse floats
      const [ , ip_s, h_s, r_s, er_s, so_s, bb_s, hr_s, pit_s, pip_s, gbfb_s ] =
        bTexts.slice(0).map((t, i) => {
          // after the label, the next 11 are the numeric we care about; we index accordingly
          const val = parseFloat(t);
          return isNaN(val) ? 0 : val;
        });

      rows.push({
        game_id,
        matchup_id,
        pitcher_role: role,
        team_name,
        team_id,
        ip: ip_s,
        h: h_s,
        r: r_s,
        er: er_s,
        so: so_s,
        bb: bb_s,
        hr: hr_s,
        pit: pit_s,
        pip: pip_s,
        gbfb: gbfb_s,
      });
    }
  }

  await browser.close();
  console.log(`→ Scraped ${rows.length} pitcher records`);
  if (DEBUG) console.log(JSON.stringify(rows, null, 2));
  return rows;
}

export async function scrapeAndSavePitchingMatchups() {
  console.log("⏳ Starting pitching-matchups scraper…");
  if (!(await testConnection())) {
    console.error("❌ Supabase connection failed, aborting.");
    process.exit(1);
  }

  try {
    const rows = await scrapePitchingMatchups();
    console.log(`→ Upserting ${rows.length} rows to Supabase…`);
    const { data, error } = await supabase
      .from("pitching_matchups")
      // make sure you've done:
      //   ALTER TABLE public.pitching_matchups
      //   ADD CONSTRAINT unique_game_role UNIQUE(game_id, pitcher_role);
      .upsert(rows, { onConflict: ["game_id", "pitcher_role"] })
      .select();

    if (error) throw error;
    console.log(`✅ Saved ${data.length} pitching records`);
    await createScrapeReport({
      success: true,
      timestamp: new Date().toISOString(),
      stats: { records: data.length },
    });

  } catch (err: any) {
    console.error("❌ Error inserting pitching stats:", err.message);
    await createScrapeReport({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
      stats: { records: 0 },
    });
  }
}

// if run directly
if (import.meta.url.endsWith("scrapePitchingMatchups.js")) {
  scrapeAndSavePitchingMatchups()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
