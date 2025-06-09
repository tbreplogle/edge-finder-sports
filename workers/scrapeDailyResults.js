// workers/scrapeDailyResults.js
//------------------------------------------------------------
//  • pulls yesterday’s predictions that actually ran
//  • keeps only bets with confidence ≥ 7.0
//  • scrapes final scores from Covers
//  • calculates P/L on a $100 stake
//  • inserts rows into mlb_daily_results
//------------------------------------------------------------
import puppeteer from "puppeteer";
import { supabase, testConnection } from "./lib/supabaseClient.js";

// ────────────────────────────────────────────────────────────
// helper: convert American odds → profit on $100 stake
// ────────────────────────────────────────────────────────────
function profitFromMoneyline(ml, stake = 100) {
  return ml > 0 ? (ml / 100) * stake : (100 / Math.abs(ml)) * stake;
}

// ────────────────────────────────────────────────────────────
async function scrapeYesterdayScores(isoDate) {
  const url = `https://www.covers.com/sports/mlb/matchups?selectedDate=${isoDate}`;
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  const rows = await page.$$eval("article.gamebox", els =>
    els.flatMap(el => {
      const link = el.querySelector("a.matchup-btn-link")?.href;
      const idMatch = link?.match(/\/matchup\/(\d+)$/);
      const scores = [...el.querySelectorAll(".team-score")].map(e =>
        parseInt(e.textContent.trim(), 10)
      );
      if (!idMatch || scores.length !== 2 || Number.isNaN(scores[0]) || Number.isNaN(scores[1]))
        return [];
      return [{ matchup_id: idMatch[1], away_score: scores[0], home_score: scores[1] }];
    })
  );

  await browser.close();
  return rows;
}

// ────────────────────────────────────────────────────────────
async function run() {
  if (!(await testConnection())) {
    console.error("❌ Supabase connection failed, aborting.");
    process.exit(1);
  }

  // compute yesterday in US-Central (UTC-5/-6)
  const nowUtc  = new Date();
  const offset  = 6 * 60 + nowUtc.getTimezoneOffset();          // rough CST/CDT
  const yester  = new Date(nowUtc.getTime() - (24 + offset / 60) * 3600 * 1000);
  const isoDate = yester.toISOString().slice(0, 10);            // YYYY-MM-DD

  // 1) pull yesterday’s predictions WITH market data
  const { data: preds, error: predErr } = await supabase
    .from("mlb_predictions_with_market")
    .select(`
      matchup_id,
      game_date,
      home_confidence,
      away_confidence,
      home_pred_ml,
      away_pred_ml
    `)
    .eq("game_date", isoDate);                                   // *** key change ***

  if (predErr) throw predErr;

  // 2) confidence filter (≥ 7.0)
  const bets = preds.filter(p =>
    Math.max(p.home_confidence ?? 0, p.away_confidence ?? 0) >= 7
  );
  if (!bets.length) {
    console.log(`No ≥7-confidence predictions for ${isoDate}`);
    return;
  }

  // 3) lookup matchup → teams
  const { data: metas, error: metaErr } = await supabase
    .from("mlb_matchups")
    .select("matchup_id, home_team_id, away_team_id")
    .eq("game_date", isoDate);

  if (metaErr) throw metaErr;
  const metaById = Object.fromEntries(metas.map(m => [m.matchup_id, m]));

  // 4) scrape scores
  const scores = await scrapeYesterdayScores(isoDate);
  const scoreById = Object.fromEntries(scores.map(s => [s.matchup_id, s]));

  // 5) build result rows
  const rows = bets.flatMap(p => {
    const meta = metaById[p.matchup_id];
    const sc   = scoreById[p.matchup_id];
    if (!meta || !sc) return [];

    const homeBetter = (p.home_confidence ?? 0) > (p.away_confidence ?? 0);
    const chosen_ml  = homeBetter ? p.home_pred_ml : p.away_pred_ml;
    if (chosen_ml == null) return [];                             // skip if ML missing

    const stake      = 100;
    const homeWon    = sc.home_score > sc.away_score;
    const betWon     = homeBetter === homeWon;
    const profit     = betWon ? profitFromMoneyline(chosen_ml, stake) : -stake;

    return [{
      matchup_id:      p.matchup_id,
      game_date:       isoDate,
      chosen_team_id:  homeBetter ? meta.home_team_id : meta.away_team_id,
      confidence:      Math.max(p.home_confidence, p.away_confidence),
      moneyline:       chosen_ml,
      stake,
      profit:          +profit.toFixed(2),
      outcome:         betWon ? "win" : "loss"
    }];
  });

  if (!rows.length) {
    console.log(`Nothing to insert for ${isoDate}`);
    return;
  }

  // 6) insert
  const { error: insErr } = await supabase.from("mlb_daily_results").insert(rows);
  if (insErr) throw insErr;

  console.log(`✅ Inserted ${rows.length} results for ${isoDate}`);
}

// ── run if called directly
if (import.meta.url.endsWith("scrapeDailyResults.js")) {
  run()
    .then(() => process.exit(0))
    .catch(err => {
      console.error("❌", err);
      process.exit(1);
    });
}
