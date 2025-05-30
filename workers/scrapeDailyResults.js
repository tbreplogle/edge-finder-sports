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

  // 1) yesterday’s date
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.toISOString().slice(0, 10);

  // 2) fetch yesterday’s predictions WITH confidence & moneyline
  const { data: preds, error: predErr } = await supabase
    .from("mlb_predictions_with_market")
    .select(`
      matchup_id,
      game_time_ct,
      home_confidence,
      away_confidence,
      home_pred_ml,
      away_pred_ml,
      home_team_id,
      away_team_id
    `)
    .eq("game_time_ct", y);  // assuming game_time_ct is YYYY-MM-DD

  if (predErr) throw predErr;

  // 3) keep only confidence ≥ 7
  const toBet = preds.filter(
    (p) =>
      Math.max(p.home_confidence ?? 0, p.away_confidence ?? 0) >= 7.0
  );

  if (toBet.length === 0) {
    console.log("No high-confidence bets for", y);
    return;
  }

  // 4) scrape actual scores
  const scores = await scrapeYesterdayScores(y);

  // 5) build upsert rows
  const rows = toBet
    .map((p) => {
      const isHome = (p.home_confidence ?? 0) > (p.away_confidence ?? 0);
      const chosenMl = isHome ? p.home_pred_ml : p.away_pred_ml;
      const chosenTeamId = isHome ? p.home_team_id : p.away_team_id;
      const stake = 100;
      const s = scores.find((s) => s.matchup_id === p.matchup_id);
      if (!s) return null;

      const winner = s.home_score > s.away_score ? "home" : "away";
      let profit = -stake;
      let outcome = "loss";
      if (winner === (isHome ? "home" : "away")) {
        outcome = "win";
        profit =
          chosenMl > 0
            ? (chosenMl / 100) * stake
            : (100 / Math.abs(chosenMl)) * stake;
      }

      return {
        matchup_id: p.matchup_id,
        game_date: y,
        chosen_team_id: chosenTeamId,
        confidence: Math.max(p.home_confidence, p.away_confidence),
        moneyline: chosenMl,
        stake,
        profit: +profit.toFixed(2),
        outcome,
      };
    })
    .filter(Boolean);

  // 6) insert into mlb_daily_results
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
