/* workers/scrapeMatchupIds.js
   ────────────────────────────────────────────────────────────
   Scrapes today’s MLB matchup IDs from Covers.com and upserts
   them into your Supabase `mlb_matchups` table.
   – Auto-scrolls once to force lazy content to render
   – Falls back to the scoreboard page on any timeout / 0-result
   – Uses the system Google Chrome (workflow installs it)
   ──────────────────────────────────────────────────────────── */

import puppeteer from "puppeteer";
import {
  supabase,
  testConnection,
  createScrapeReport,
} from "./lib/supabaseClient.js";

const DEBUG = process.env.DEBUG === "true";

/* label → team_id (teams_mlb.alt_name) */
const TEAM_NAME_TO_ID = {
  WASHINGTON: 24, ATLANTA: 17, "TAMPA BAY": 9,  BOSTON: 29,
  COLORADO: 22,   MILWAUKEE: 14, "KANSAS CITY": 11, MINNESOTA: 10,
  "ST. LOUIS": 27,"CHI. CUBS": 16, "NY YANKEES": 8, MIAMI: 6,
  ATHLETICS: 7,   "LA ANGELS": 4, ARIZONA: 13,
  CLEVELAND: 2,   CINCINNATI: 23, PHILADELPHIA: 26, TEXAS: 28,
  DETROIT: 25,    HOUSTON: 19,   "CHI. WHITE SOX": 15, BALTIMORE: 30,
  PITTSBURGH: 3,  "SAN FRANCISCO": 12, "SAN DIEGO": 18, "LA DODGERS": 21,
  SEATTLE: 1,     TORONTO: 5,    "NY METS": 20,
};

/*─────────────────────────────────────────────────────────────*/
async function scrapeFromUrl(page, url) {
  console.log(`→ Opening ${url}`);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60_000 });

  /* kick the page to render lazy content */
  await page.evaluate(() => window.scrollBy(0, 250));

  try {
    await page.waitForSelector("article.gamebox", { timeout: 15_000 });
  } catch {
    /* no game boxes; return empty list so caller can fall back */
    console.warn("⚠️  No game boxes rendered (timeout)");
    return [];
  }

  const games = await page.$$eval("article.gamebox", (nodes) =>
    nodes.map((node) => {
      const a = node.querySelector('a[href*="/matchup/"]');
      if (!a) return null;
      const m = a.href.match(/\/matchup\/(\d+)$/);
      if (!m) return null;

      const matchup_id = m[1];
      const game_id = matchup_id; // 1-to-1

      const label = node
        .querySelector("strong.text-uppercase")
        ?.innerText.trim()
        .toUpperCase();
      if (!label || !label.includes("@")) return null;
      const [away_team, home_team] = label
        .split("@")
        .map((s) => s.replace(/\u202F/g, " ").trim());

      /* pre-game time → date string */
      const dateText = node
        .querySelector("strong.preGame-status")
        ?.innerText.trim();
      const game_date = dateText
        ? new Date(`${dateText} ${new Date().getFullYear()}`)
            .toISOString()
            .slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      return { matchup_id, game_id, away_team, home_team, game_date };
    }),
  );

  return games.filter(Boolean);
}

/*─────────────────────────────────────────────────────────────*/
async function scrapeTodayMatchups() {
  const today = new Date().toISOString().slice(0, 10);

  const browser = await puppeteer.launch({
    channel: "chrome",
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
  );

  const primary =
    `https://www.covers.com/sport/baseball/mlb/matchups?selectedDate=${today}`;
  let games = await scrapeFromUrl(page, primary);

  /* scoreboard fallback */
  if (games.length === 0) {
    const fallback =
      `https://www.covers.com/sport/baseball/mlb/scoreboard?selectedDate=${today}`;
    games = await scrapeFromUrl(page, fallback);
  }

  await browser.close();
  console.log(`→ Scraped ${games.length} games`);
  if (DEBUG) console.log(JSON.stringify(games, null, 2));
  return games;
}

/*─────────────────────────────────────────────────────────────*/
export async function scrapeAndSaveTodayMatchups() {
  console.log("⏳ MLB matchup scraper starting…");
  if (!(await testConnection())) throw new Error("Supabase unreachable");

  try {
    const scraped = await scrapeTodayMatchups();

    if (!scraped.length) {
      await createScrapeReport({
        success: false,
        error: "No matchups found",
        timestamp: new Date().toISOString(),
        stats: { matchups: 0 },
      });
      return { success: false, error: "No matchups found", matchups: [] };
    }

    const rows = scraped.map((g) => ({
      ...g,
      away_team_id: TEAM_NAME_TO_ID[g.away_team] ?? null,
      home_team_id: TEAM_NAME_TO_ID[g.home_team] ?? null,
      created_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("mlb_matchups")
      .upsert(rows, { onConflict: ["matchup_id"] })
      .select();
    if (error) throw error;

    await createScrapeReport({
      success: true,
      timestamp: new Date().toISOString(),
      stats: { matchups: data.length },
      matchups: data,
    });

    console.log(`✅ Saved ${data.length} rows`);
    return { success: true, matchups: data };
  } catch (err) {
    console.error("❌ Scraper error:", err.message);
    await createScrapeReport({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
      stats: { matchups: 0 },
    });
    return { success: false, error: err.message, matchups: [] };
  }
}

/*─────────────────────────────────────────────────────────────*/
if (import.meta.url.endsWith("scrapeMatchupIds.js")) {
  scrapeAndSaveTodayMatchups()
    .then((res) => {
      console.log(JSON.stringify(res, null, 2));
      process.exit(res.success ? 0 : 1);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
