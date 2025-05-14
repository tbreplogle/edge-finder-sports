/* workers/scrapeMatchupIds.js
   ────────────────────────────────────────────────────────────────────
   • Scrapes today’s MLB matchup‑IDs from Covers.com
   • Maps team names → teams_mlb.team_id
   • Upserts one row per game into the mlb_matchups table
   • Writes a scrape‑report row for observability
   • Uses the *system* Google Chrome (channel:"chrome") so that
     GitHub Actions runners do not need to download Chromium
   ──────────────────────────────────────────────────────────────────── */

import puppeteer from "puppeteer";
import {
  supabase,
  testConnection,
  createScrapeReport,
} from "./lib/supabaseClient.js";

const DEBUG = process.env.DEBUG === "true";

/* Covers “TEAM A @ TEAM B” → your teams_mlb.team_id */
const TEAM_NAME_TO_ID = {
  // home teams
  WASHINGTON: 24,
  ATLANTA: 17,
  "TAMPA BAY": 9,
  BOSTON: 29,
  COLORADO: 22,
  MILWAUKEE: 14,
  "KANSAS CITY": 11,
  MINNESOTA: 10,
  "ST. LOUIS": 27,
  "CHI. CUBS": 16,
  "NY YANKEES": 8,
  MIAMI: 6,
  ATHLETICS: 7,
  "LA ANGELS": 4,
  ARIZONA: 13,

  // away teams
  CLEVELAND: 2,
  CINCINNATI: 23,
  PHILADELPHIA: 26,
  TEXAS: 28,
  DETROIT: 25,
  HOUSTON: 19,
  "CHI. WHITE SOX": 15,
  BALTIMORE: 30,
  PITTSBURGH: 3,
  "SAN FRANCISCO": 12,
  "SAN DIEGO": 18,
  "LA DODGERS": 21,
  SEATTLE: 1,
  TORONTO: 5,
  "NY METS": 20,
};

/* ────────────────────────────────────────────────────────────────── */
/* 1 — Scrape today’s matchup IDs                                    */
/* ────────────────────────────────────────────────────────────────── */
async function scrapeTodayMatchups() {
  console.log("→ Launching headless Chrome ( system channel ) …");

  /* use the system Chrome the workflow installs */
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

  /* Covers scoreboard URL for today */
  const today = new Date().toISOString().slice(0, 10);
  const url = `https://www.covers.com/sport/baseball/mlb/scoreboard?selectedDate=${today}`;

  console.log(`→ Opening ${url}`);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60_000 });
  await page.waitForSelector('a[href*="/matchup/"]', { timeout: 30_000 });

  /* pull all <article.gamebox> elements */
  const matchups = await page.$$eval("article.gamebox", (games) =>
    games
      .map((game) => {
        const link = game.querySelector('a[href*="/matchup/"]');
        if (!link) return null;

        /* 1) matchup + game IDs */
        const m = link.href.match(/\/matchup\/(\d+)$/);
        if (!m) return null;
        const matchup_id = m[1];
        const game_id = matchup_id; // 1‑to‑1 for now

        /* 2) "AWAY @ HOME" label */
        const label = game
          .querySelector("strong.text-uppercase")
          ?.innerText.trim()
          .toUpperCase();
        if (!label || !label.includes("@")) return null;

        const [away_team, home_team] = label
          .split("@")
          .map((t) => t.replace(/\u202F/g, " ").trim());

        /* 3) date on the tile (local time not important here) */
        const dateTxt = game
          .querySelector("strong.preGame-status")
          ?.innerText.trim();
        const game_date = dateTxt
          ? new Date(`${dateTxt} ${new Date().getFullYear()}`)
              .toISOString()
              .slice(0, 10)
          : today;

        return { matchup_id, game_id, away_team, home_team, game_date };
      })
      .filter(Boolean),
  );

  await browser.close();
  console.log(`→ Scraped ${matchups.length} games`);
  if (DEBUG) console.log(JSON.stringify(matchups, null, 2));
  return matchups;
}

/* ────────────────────────────────────────────────────────────────── */
/* 2 — Enrich, upsert, report                                        */
/* ────────────────────────────────────────────────────────────────── */
export async function scrapeAndSaveTodayMatchups() {
  console.log("⏳ MLB matchup scraper starting…");

  if (!(await testConnection())) {
    throw new Error("Supabase connection failed");
  }

  const scraped = await scrapeTodayMatchups();

  if (scraped.length === 0) {
    console.warn("⚠️  No matchups scraped");
    await createScrapeReport({
      success: false,
      error: "No matchups found",
      timestamp: new Date().toISOString(),
      stats: { matchups: 0 },
    });
    return { success: false, error: "No matchups found", matchups: [] };
  }

  /* map team names → IDs */
  const rows = scraped.map((m) => ({
    ...m,
    away_team_id: TEAM_NAME_TO_ID[m.away_team] ?? null,
    home_team_id: TEAM_NAME_TO_ID[m.home_team] ?? null,
    created_at: new Date().toISOString(),
  }));

  console.log(`→ Upserting ${rows.length} rows into mlb_matchups …`);
  const { data, error } = await supabase
    .from("mlb_matchups")
    .upsert(rows, { onConflict: ["matchup_id"] })
    .select();

  if (error) {
    console.error("❌ Supabase error:", error.message);
    await createScrapeReport({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      stats: { matchups: 0 },
    });
    return { success: false, error: error.message, matchups: [] };
  }

  console.log(`✅ Saved ${data.length} rows`);
  await createScrapeReport({
    success: true,
    timestamp: new Date().toISOString(),
    stats: { matchups: data.length },
    matchups: data,
  });

  return { success: true, matchups: data };
}

/* ────────────────────────────────────────────────────────────────── */
/* 3 — CLI entry‑point                                               */
/* ────────────────────────────────────────────────────────────────── */
if (import.meta.url.endsWith("scrapeMatchupIds.js")) {
  scrapeAndSaveTodayMatchups()
    .then((res) => {
      console.log(JSON.stringify(res, null, 2));
      process.exit(res.success ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
