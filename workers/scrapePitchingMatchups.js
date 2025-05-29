// workers/scrapePitchingMatchups.js
import puppeteer from "puppeteer";
import {
  supabase,
  testConnection,
  createScrapeReport,
} from "./lib/supabaseClient.js";

const DEBUG = process.env.DEBUG === "true";

/** Map team labels → team_id (from teams_mlb.alt_name) */
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
  // 1) load today’s market‐odds rows
  const today = new Date().toISOString().slice(0, 10);
  const { data: games, error } = await supabase
    .from("mlb_market_odds")
    .select("matchup_id,game_id")
    .eq("game_date", today);

  if (error) throw new Error(`Could not load games: ${error.message}`);
  if (!games?.length) {
    console.warn("⚠️ No market-odds rows for today");
    return [];
  }

  // 2) dedupe by game_id (so every double header is kept)
  const uniqueGames = Array.from(
    new Map(games.map((g) => [g.game_id, g])).values()
  );
  console.log(`→ Found ${games.length} rows, ${uniqueGames.length} unique game_ids`);

  // 3) launch Puppeteer
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

  for (const { matchup_id, game_id } of uniqueGames) {
    const url = `https://www.covers.com/sport/baseball/mlb/matchup/${matchup_id}`;
    console.log(`→ Scraping ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    for (const role of ["away", "home"]) {
      const tab = role === "away" ? "#away-team-last-5" : "#home-team-last-5";

      // team → id
      let team_name = null;
      let team_id = null;
      try {
        team_name = await page.$eval(
          `a[href="${tab}"]`,
          (el) => el.textContent.trim().toUpperCase()
        );
        team_id = TEAM_ALT_NAME_TO_ID[team_name] ?? null;
      } catch {
        console.warn(`⚠️ No team name for ${role} of ${matchup_id}`);
        continue;
      }

      // pitcher name
      let pitcher_name = null;
      try {
        pitcher_name = await page.$eval(
          `${tab} a.anchor-with-border`,
          (el) => el.textContent.trim()
        );
      } catch {
        console.warn(`⚠️ No ${role} pitcher for ${matchup_id}`);
        continue;
      }

      // find the “last X avg” row
      const trs = await page.$$(`${tab} table tr`);
      const statRow = trs.find(async (tr) => {
        try {
          const txt = (await tr.$eval("td b", (b) => b.textContent)).toLowerCase();
          return txt.includes("last") && txt.includes("avg");
        } catch {
          return false;
        }
      });
      if (!statRow) {
        console.warn(`⚠️ Stats missing for ${role} of ${matchup_id}`);
        continue;
      }

      // extract the 10 numbers
      const cells = await statRow.$$eval("td b", (bs) =>
        bs.map((b) => b.textContent.trim())
      );
      const nums = cells.slice(1);
      if (nums.length < 10) {
        console.warn(
          `⚠️ Unexpected # cols (${nums.length}) for ${role} ${matchup_id}`
        );
        continue;
      }
      const [ip_s, h_s, r_s, er_s, so_s, bb_s, hr_s, pit_s, pip_s, gbfb_s] = nums.map(
        (v) => parseFloat(v) || 0
      );

      const { ip, h, r, er, so, bb, hr, pit, pip, gbfb } = {
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
      };
      const era = ip > 0 ? +((er / ip) * 9).toFixed(2) : null;
      const era_plus = era ? Math.round((100 * 4.1) / era) : null;
      const whip = ip > 0 ? +(((bb + h) / ip).toFixed(3)) : null;

      rows.push({
        game_id,
        matchup_id,
        pitcher_role: role,
        team_name,
        team_id,
        pitcher_name,
        ip,
        h,
        r,
        er,
        so,
        bb,
        hr,
        pit,
        pip,
        gbfb,
        era,
        era_plus,
        whip,
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
    console.log(`→ Upserting ${rows.length} rows to Supabase…`);
    const { data, error } = await supabase
      .from("pitching_matchups")
      .upsert(rows, {
        onConflict: ["game_id", "pitcher_role"],
      })
      .select();
    if (error) throw error;
    console.log(`✅ Saved ${data.length} rows`);
    await createScrapeReport({
      success: true,
      timestamp: new Date().toISOString(),
      stats: { records: data.length },
    });
  } catch (err) {
    console.error("❌ Error inserting pitching stats:", err.message);
    await createScrapeReport({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
      stats: { records: 0 },
    });
  }
}

// CLI
if (import.meta.url.endsWith("scrapePitchingMatchups.js")) {
  scrapeAndSavePitchingMatchups().then(() => process.exit(0));
}
