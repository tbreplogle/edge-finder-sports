// workers/scrapeDailyResults.js
import puppeteer from 'puppeteer';
import { supabase } from './lib/supabaseClient.js';
import { fetchMlbPredictions } from '../utils/fetchMlbPredictions.js';

async function scrapeYesterdayScores(date) {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const url = `https://www.covers.com/sports/mlb/matchups?selectedDate=${date}`;
  await page.goto(url, { waitUntil: 'networkidle2' });

  // For each gamebox, pull matchup_id, away_score, home_score
  const results = await page.$$eval('article.gamebox', (games) =>
    games.map((game) => {
      const link = game.querySelector('a.matchup-btn-link');
      const m = link?.href.match(/\/matchup\/(\d+)$/);
      const matchup_id = m?.[1];
      const scores = [...game.querySelectorAll('.team-score')]
        .map((el) => parseInt(el.textContent.trim(), 10));
      if (!matchup_id || scores.length !== 2) return null;
      return {
        matchup_id,
        away_score: scores[0],
        home_score: scores[1],
      };
    }).filter(Boolean)
  );

  await browser.close();
  return results;
}

async function run() {
  // 1) Determine yesterday’s date in YYYY-MM-DD
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.toISOString().slice(0, 10);

  // 2) Fetch your predictions
  const preds = await fetchMlbPredictions(); 
  // filter to yesterday’s games & confidence ≥ 7.0
  const toBet = preds.filter((p) => {
    return (
      p.game_time_ct.slice(0, 10) === y &&
      Math.max(p.home_confidence, p.away_confidence) >= 7.0
    );
  });

  if (toBet.length === 0) {
    console.log('No high-confidence bets for', y);
    return;
  }

  // 3) Scrape actual scores
  const scores = await scrapeYesterdayScores(y);

  // 4) For each bet, compute profit/loss
  const rows = toBet.map((p) => {
    const isHome = p.home_confidence > p.away_confidence;
    const chosen = isHome ? 'home' : 'away';
    const chosenTeamId = isHome ? p.home_team_id : p.away_team_id;
    const ml = isHome ? p.home_pred_ml : p.away_pred_ml;
    const stake = 100;
    const resultObj = scores.find((s) => s.matchup_id === p.matchup_id);
    let profit = 0, outcome = 'loss';
    if (resultObj) {
      const winner = resultObj.home_score > resultObj.away_score ? 'home' : 'away';
      if (winner === chosen) {
        // win: positive profit
        profit = ml > 0 ? (ml / 100) * stake : (100 / Math.abs(ml)) * stake;
        outcome = 'win';
      } else {
        profit = -stake;
      }
    } else {
      // couldn’t scrape score; skip.
      return null;
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
  }).filter(Boolean);

  // 5) Upsert into Supabase
  const { error } = await supabase
    .from('mlb_daily_results')
    .insert(rows);
  if (error) throw error;

  console.log(`Saved ${rows.length} results for ${y}`);
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
