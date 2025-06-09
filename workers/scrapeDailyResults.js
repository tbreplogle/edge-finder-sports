// workers/scrapeDailyResults.js
import puppeteer from 'puppeteer';
import { supabase, testConnection } from './lib/supabaseClient.js';

/* ---------------------------------------------------------- */
/*  1. helpers                                                */
/* ---------------------------------------------------------- */

/** Midnight-to-midnight ISO strings for “yesterday” in UTC */
function getYesterdayRange() {
  const end   = new Date();          // now
  end.setUTCHours(0, 0, 0, 0);       // today 00:00 UTC
  const start = new Date(end);       // copy
  start.setUTCDate(start.getUTCDate() - 1); // yesterday 00:00 UTC
  return {
    yDate:   start.toISOString().slice(0, 10),   // YYYY-MM-DD
    startISO: start.toISOString(),               // YYYY-MM-DDT00:00:00Z
    endISO:   end.toISOString()                  // today 00:00:00Z
  };
}

/** Convert American odds to profit on \$stake */
function oddsToProfit(ml, stake = 100) {
  return ml > 0
    ?  (ml / 100)      * stake           // under-dog
    : (100 / Math.abs(ml)) * stake;      // favourite
}

/* ---------------------------------------------------------- */
/*  2. scrape yesterday’s final scores from Covers            */
/* ---------------------------------------------------------- */
async function scrapeYesterdayScores(date) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(
    `https://www.covers.com/sports/mlb/matchups?selectedDate=${date}`,
    { waitUntil: 'networkidle2', timeout: 60000 }
  );

  const rows = await page.$$eval('article.gamebox', boxes =>
    boxes.map(box => {
      const link = box.querySelector('a.matchup-btn-link')?.href ?? '';
      const m    = link.match(/\/matchup\/(\d+)$/);
      const id   = m ? m[1] : null;

      const scores = Array.from(
        box.querySelectorAll('.team-score')
      ).map(el => parseInt(el.textContent.trim(), 10));

      if (!id || scores.length !== 2) return null;
      return {
        matchup_id: id,
        away_score : scores[0],
        home_score : scores[1]
      };
    }).filter(Boolean)
  );

  await browser.close();
  return rows;
}

/* ---------------------------------------------------------- */
/*  3. main                                                   */
/* ---------------------------------------------------------- */
async function run() {
  /* ─── DB ready? ────────────────────────────────────────── */
  if (!(await testConnection())) {
    console.error('❌ Supabase connection failed - aborting.');
    process.exit(1);
  }

  /* ─── date literals for yesterday ─────────────────────── */
  const { yDate, startISO, endISO } = getYesterdayRange();

  /* ─── pull predictions generated for yesterday ────────── */
  const { data: preds, error: predErr } = await supabase
    .from('mlb_predictions_with_market')
    .select(`
      matchup_id,
      game_time_ct,
      home_confidence,
      away_confidence,
      home_pred_ml,
      away_pred_ml
    `)
    .gte('game_time_ct', startISO)
    .lt('game_time_ct', endISO);

  if (predErr) throw predErr;

  /* ─── matchups table (team IDs) ───────────────────────── */
  const { data: metas, error: metaErr } = await supabase
    .from('mlb_matchups')
    .select('matchup_id, home_team_id, away_team_id')
    .eq('game_date', yDate);

  if (metaErr) throw metaErr;

  const metaById = Object.fromEntries(
    metas.map(m => [m.matchup_id, m])
  );

  /* ─── only high-confidence edges ( >= 7 ) ─────────────── */
  const toBet = preds.filter(p =>
    Math.max(p.home_confidence ?? 0, p.away_confidence ?? 0) >= 7
  );

  if (toBet.length === 0) {
    console.log(`No ≥7-confidence bets for ${yDate}`);
    return;
  }

  /* ─── final scores scrape ─────────────────────────────── */
  const scores = await scrapeYesterdayScores(yDate);
  const scoreById = Object.fromEntries(
    scores.map(s => [s.matchup_id, s])
  );

  /* ─── assemble P/L rows ───────────────────────────────── */
  const stake = 100;
  const rows = toBet.map(p => {
    const meta  = metaById[p.matchup_id];
    const score = scoreById[p.matchup_id];
    if (!meta || !score) return null;

    const betHome   = (p.home_confidence ?? 0) >= (p.away_confidence ?? 0);
    const chosenML  = betHome ? p.home_pred_ml : p.away_pred_ml;
    const winnerIsHome = score.home_score > score.away_score;
    const win        = winnerIsHome === betHome;

    return {
      matchup_id       : p.matchup_id,
      game_date        : yDate,
      chosen_team_id   : betHome ? meta.home_team_id : meta.away_team_id,
      confidence       : Math.max(p.home_confidence, p.away_confidence),
      moneyline        : chosenML,
      stake,
      profit           : win ? +oddsToProfit(chosenML, stake).toFixed(2) : -stake,
      outcome          : win ? 'win' : 'loss'
    };
  }).filter(Boolean);

  /* ─── insert into mlb_daily_results ───────────────────── */
  if (!rows.length) {
    console.warn('No complete rows to insert – aborting write.');
    return;
  }

  const { error: insErr } = await supabase
    .from('mlb_daily_results')
    .insert(rows);

  if (insErr) throw insErr;
  console.log(`✅ Saved ${rows.length} results for ${yDate}`);
}

/* ---------------------------------------------------------- */
/*  4. run if executed directly                               */
/* ---------------------------------------------------------- */
if (import.meta.url.endsWith('scrapeDailyResults.js')) {
  run()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌', err);
      process.exit(1);
    });
}
