/*  workers/scrapePitchingMatchups.js  */

import puppeteer from "puppeteer";
import {
  supabase,
  testConnection,
  createScrapeReport,
} from "./lib/supabaseClient.js";

const DEBUG = process.env.DEBUG === "true";

/* ———————————————————————————————————————————————————————————
   Covers team-label  ->  teams_mlb.alt_name  ->  team_id
   (add or adjust mappings if Covers ever changes a label)
———————————————————————————————————————————————————————————*/
const TEAM_ALT_NAME_TO_ID = {
  SEATTLE: 1,  CLEVELAND: 2,  PITTSBURGH: 3, "LA ANGELS": 4,  TORONTO: 5,
  MIAMI: 6,    ATHLETICS: 7,  "NY YANKEES": 8, "TAMPA BAY": 9, MINNESOTA: 10,
  "KANSAS CITY": 11, "SF GIANTS": 12, "SAN FRANCISCO": 12,  ARIZONA: 13,
  MILWAUKEE: 14, "CHI. WHITE SOX": 15, "CHI. CUBS": 16,  ATLANTA: 17,
  "SAN DIEGO": 18, HOUSTON: 19, "NY METS": 20, "LA DODGERS": 21,
  COLORADO: 22, CINCINNATI: 23, WASHINGTON: 24, DETROIT: 25,
  PHILADELPHIA: 26, "ST. LOUIS": 27, TEXAS: 28, BOSTON: 29, BALTIMORE: 30,
};

/*──────────────────────────────────────────────────────────────
   Scrape all pitching match-ups for *today* and return rows[]
──────────────────────────────────────────────────────────────*/
async function scrapePitchingMatchups() {
  /* 1️⃣ Pull today’s games from mlb_market_odds */
  const today = new Date().toISOString().slice(0, 10);
  const { data: oddsRows, error } = await supabase
    .from("mlb_market_odds")
    .select("matchup_id, game_id")
    .eq("game_date", today);

  if (error) throw new Error(error.message);
  if (!oddsRows?.length) {
    console.warn("⚠️  No games with market odds found for today.");
    return [];
  }

  /*  Deduplicate by *game_id* so each scheduled game is scraped once.
      (Multiple rows per game_id are normal as the odds table updates.)
  */
  const uniqueGames = Array.from(
    new Map(oddsRows.map((g) => [g.game_id, g])).values()
  );
  console.log(
    `→ Found ${oddsRows.length} odds-rows, ${uniqueGames.length} unique games`
  );

  /* 2️⃣ Launch Puppeteer (system Chrome) */
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

  /* 3️⃣ Loop through each game (two pitchers per game) */
  for (const { matchup_id, game_id } of uniqueGames) {
    const url = `https://www.covers.com/sport/baseball/mlb/matchup/${matchup_id}`;
    console.log(`→ Scraping ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60_000 });
    await page.waitForSelector('a[href="#away-team-last-5"]', {
      timeout: 30_000,
    });

    for (const role of ["away", "home"]) {
      const tab = role === "away" ? "#away-team-last-5" : "#home-team-last-5";

      /* → Team label & team_id */
      let team_name = null;
      let team_id   = null;
      try {
        team_name = await page.$eval(
          `a[href="${tab}"]`,
          (el) => el.innerText.trim().toUpperCase()
        );
        team_id = TEAM_ALT_NAME_TO_ID[team_name] ?? null;
      } catch {
        console.warn(`⚠️  Team name missing for ${role} (${matchup_id})`);
      }

      /* → Pitcher name */
      let pitcher_name = null;
      try {
        pitcher_name = await page.$eval(
          `${tab} a.anchor-with-border`,
          (el) => el.innerText.trim()
        );
      } catch {
        console.warn(`⚠️  Pitcher missing for ${role} (${matchup_id})`);
        continue;
      }

      /* → “Last X AVG” stats row (10 numeric columns) */
      const trHandles = await page.$$(`${tab} table tr`);
      const lastAvgRow = trHandles.find(async (tr) => {
        try {
          const txt = await tr.$eval(
            "td b",
            (b) => b.innerText.trim().toLowerCase()
          );
          return txt.includes("last") && txt.includes("avg");
        } catch {
          return false;
        }
      });
      if (!lastAvgRow) {
        console.warn(`⚠️  Stats missing for ${role} (${matchup_id})`);
        continue;
      }

      const cells = await lastAvgRow.$$eval("td b", (bs) =>
        bs.map((b) => b.innerText.trim())
      );
      if (cells.length < 11) {
        console.warn(`⚠️  Unexpected stats format for ${role} (${matchup_id})`);
        continue;
      }
      /* cells[0] is just the “LAST 5 AVG” label */
      const [
        ip_s,
        h_s,
        r_s,
        er_s,
        so_s,
        bb_s,
        hr_s,
        pit_s,
        pip_s,
        gbfb_s,
      ] = cells.slice(1);

      const num = (s) => (parseFloat(s) || 0);
      const ip  = num(ip_s),
        h = num(h_s),
        r = num(r_s),
        er = num(er_s),
        so = num(so_s),
        bb = num(bb_s),
        hr = num(hr_s),
        pit = num(pit_s),
        pip = num(pip_s),
        gbfb = num(gbfb_s);

      const era      = ip ? +( (er / ip) * 9 ).toFixed(2) : null;
      const era_plus = era ? Math.round((100 * 4.1) / era) : null;
      const whip     = ip ? +(((bb + h) / ip).toFixed(3)) : null;

      if (DEBUG) console.log({ game_id, matchup_id, role, pitcher_name });

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
  console.log(`→ Scraped ${rows.length} pitcher rows`);
  if (DEBUG) console.log(JSON.stringify(rows, null, 2));
  return rows;
}

/*───────────────────────────────────────────────────────────────
   Persist results
───────────────────────────────────────────────────────────────*/
export async function scrapeAndSavePitchingMatchups() {
  console.log("⏳ Starting pitching-matchups scraper…");
  if (!(await testConnection())) {
    console.error("❌ Supabase connection failed.");
    process.exit(1);
  }

  try {
    const rows = await scrapePitchingMatchups();
    if (!rows.length) return;

    console.log(`→ Upserting ${rows.length} rows…`);
    const { error } = await supabase
      .from("pitching_matchups")
      .upsert(rows, { onConflict: ["game_id", "pitcher_role"] });

    if (error) throw error;

    console.log("✅ Upsert complete");
    await createScrapeReport({
      success: true,
      timestamp: new Date().toISOString(),
      stats: { records: rows.length },
    });
  } catch (err) {
    console.error("❌", err.message);
    await createScrapeReport({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
      stats: { records: 0 },
    });
  }
}

/* CLI */
if (import.meta.url.endsWith("scrapePitchingMatchups.js")) {
  scrapeAndSavePitchingMatchups()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
