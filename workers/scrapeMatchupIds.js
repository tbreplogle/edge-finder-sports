// workers/scrapeMatchupIds.js
import puppeteer from 'puppeteer';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

const DEBUG = process.env.DEBUG === 'true';

async function scrapeTodayMatchups() {
  console.log("→ Launching browser and navigating to Covers.com MLB matchups…");
  const browser = await puppeteer.launch({
    args: ["--no-sandbox","--disable-setuid-sandbox"],
    headless: "new"
  });
  const page = await browser.newPage();
  await page.setViewport({ width:1920, height:1080 });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
  );
  await page.goto("https://www.covers.com/sports/mlb/matchups", {
    waitUntil: "networkidle2", timeout: 60000
  });
  // let React finish rendering
  await page.waitForSelector("a.matchup-btn-link", { timeout: 30000 });
  await page.waitForTimeout(1000);

  const matchups = await page.$$eval("article.gamebox", articles => {
    return articles.map(a => {
      const link = a.querySelector("a.matchup-btn-link");
      if (!link) return null;
      const m = link.href.match(/\/matchup\/(\d+)$/);
      if (!m) return null;
      const matchup_id = m[1];
      // header strong holds "Away @ Home"
      const header = a.querySelector("p.gamebox-header strong.text-uppercase");
      if (!header) return null;
      const [away, home] = header.innerText.split("@").map(t => t.trim());
      // pick desktop date first
      const dateSpan = a.querySelector("strong.preGame-status span.d-none.d-xl-inline")
                      || a.querySelector("strong.preGame-status span");
      const dateText = dateSpan?.innerText.trim();
      let game_date = null;
      if (dateText) {
        const dt = new Date(`${dateText} ${new Date().getFullYear()}`);
        game_date = isNaN(dt) ? null : dt.toISOString().slice(0,10);
      }
      return { game_id: matchup_id, matchup_id, away_team: away, home_team: home, game_date };
    }).filter(x => x !== null);
  });

  await browser.close();
  console.log(`→ Scraped ${matchups.length} games.`);
  if (DEBUG) console.log(JSON.stringify(matchups, null,2));
  return matchups;
}

async function main() {
  console.log("Starting MLB matchup scraper…");
  if (!(await testConnection())) {
    console.error("❌ Supabase connection failed, aborting.");
    process.exit(1);
  }

  try {
    const matchups = await scrapeTodayMatchups();
    if (matchups.length === 0) {
      console.warn("⚠️  No matchups found today — nothing to insert.");
      createScrapeReport({
        success: false,
        error: "No matchups found",
        timestamp: new Date().toISOString(),
        stats: { matchups: 0 }
      });
      process.exit(0);
    }

    console.log(`→ Upserting ${matchups.length} records to Supabase…`);
    const { data, error } = await supabase
      .from("mlb_matchups")
      .upsert(matchups, { onConflict: ["matchup_id"] })
      .select();

    if (error) throw error;

    console.log(`✅ Saved ${data.length} rows.`);
    createScrapeReport({
      success: true,
      timestamp: new Date().toISOString(),
      stats: { matchups: data.length },
      matchups: data
    });
    process.exit(0);

  } catch (err) {
    console.error("❌ Error in scraper:", err.message);
    createScrapeReport({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
      stats: { matchups: 0 }
    });
    process.exit(1);
  }
}

// run immediately
main();
