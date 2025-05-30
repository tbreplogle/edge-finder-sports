// workers/scrapeDailyResults.js
import puppeteer from "puppeteer";
import { supabase, testConnection } from "./lib/supabaseClient.js";

async function scrapeYesterdayScores(date) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const url = `https://www.covers.com/sports/mlb/matchups?selectedDate=${date}`;
  await page.goto(url, { waitUntil: "networkidle2" });

  const results = await page.$$eval("article.gamebox", (games) =>
    games
      .map((game) => {
        const link = game.querySelector("a.matchup-btn-link");
        const m = link?.href.match(/\/matchup\/(\d+)$/);
        const matchup_id = m?.[1];
        const scores = [...game.querySelectorAll(".team-score")].map((el) =>
          parseInt(el.textContent.trim(), 10)
        );
        if (!matchup_id || scores.length !== 2) return null;
        return {
          matchup_id,
          away_score: scores[0],
          home_score: scores[1],
        };
      })
      .filter(Boolean)
  );

  await browser.close();
  return results;
}

async function run() {
  if (!(await testConnection())) {
    console.error("❌ Supabase connection failed, aborting.");
    process.exit(1);
  }

  // 1) Compute yesterday’s YYYY-MM-DD
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.toISOString().slice(0, 10);

  // 2) Pull yesterday’s predictions (with confidences & moneylines)
  const { data: preds, error: predErr } = await supabase
    .from("mlb_predictions_with_market")
    .select(`
      matchup_id,
      game_time_ct,
      home_confidence,
      away_confidence,
      home_pred_ml,
      away_pred_ml
    `)
    .eq("game_time_ct", y);

  if (predErr) throw predErr;

  // 3) Pull the matchup IDs → team_id mapping from mlb_matchups
  const { data: metas, error: metaErr } = await supabase
    .from("mlb_matchups")
    .select("matchup_id, home_team_id, away_team_id")
    .eq("game_date", y);

  if (metaErr) throw metaErr;

  // Build a lookup
  const metaById = {};
  metas.forEach((m) => {
    metaById[m.matchup_id] = m;
  });

  // 4) Filter to confidence ≥ 7.0
  const toBet = preds.filter((p) => {
    const hc = p.home_confidence ?? 0;
    const ac = p.away_confidence ?? 0;
    return Math.max(hc, ac) >= 7.0;
  });

  if (toBet.length === 0) {
    console.log("No high-confidence bets for", y);
    return;
  }

  // 5) Scrape final scores
  const scores = await scrapeYesterdayScores(y);

  // 6) Compute profit/loss rows
  const rows = toBet
    .map((p) => {
      const meta = metaById[p.matchup_id];
      if (!meta) {
        console.warn(
          `⚠️ No mlb_matchups entry for ${p.matchup_id} on ${y}`
        );
        return null;
      }

      // decide which side we bet
      const isHome = (p.home_confidence ?? 0) > (p.away_confidence ?? 0);
      const ml = isHome ? p.home_pred_ml : p.away_pred_ml;
      const chosenTeamId = isHome
        ? meta.home_team_id
        : meta.away_team_id;
      const stake = 100;

      // find the scraped score
      const sc = scores.find((s) => s.matchup_id === p.matchup_id);
      if (!sc) {
        console.warn(`⚠️ No score found for matchup ${p.matchup_id}`);
        return null;
      }

      const winner = sc.home_score > sc.away_score ? "home" : "away";
      let profit = -stake;
      let outcome = "loss";
      if (winner === (isHome ? "home" : "away")) {
        outcome = "win";
        profit =
          ml > 0
            ? (ml / 100) * stake
            : (100 / Math.abs(ml)) * stake;
      }

      return {
        matchup_id: p.matchup_id,
        game_date: y,
        chosen_team_id: chosenTeamId,
        confidence: Math.max(p.home_confidence, p.away_confidence),
        moneyline: ml,
        stake,
        profit: +profit.toFixed(2),
        outcome,
      };
    })
    .filter(Boolean);

  // 7) Insert into mlb_daily_results
  const { error: insertErr } = await supabase
    .from("mlb_daily_results")
    .insert(rows);

  if (insertErr) throw insertErr;
  console.log(`✅ Saved ${rows.length} results for ${y}`);
}

if (import.meta.url.endsWith("scrapeDailyResults.js")) {
  run()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
