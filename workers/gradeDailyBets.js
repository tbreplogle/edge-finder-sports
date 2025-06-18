/*  Grade yesterday’s locked bets  (updated 2025-06-18)
   ----------------------------------------------------
   • Reads bets from public.mlb_daily_bets
   • Scrapes final scores from Covers.com
   • Saves P/L rows to public.mlb_daily_results
*/
import puppeteer from 'puppeteer';
import { supabase, testConnection } from './lib/supabaseClient.js';

/* ---------- helpers --------------------------------------------------- */
function yesterdayCT () {
  const ct = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
  );
  ct.setDate(ct.getDate() - 1);
  return ct.toISOString().slice(0, 10);         // YYYY-MM-DD
}

/* ---------- scraping -------------------------------------------------- */

/** scrape the main match-ups list once */
async function scrapeListPage (date) {
  const url = `https://www.covers.com/sports/mlb/matchups?selectedDate=${date}`;

  const browser = await puppeteer.launch({
    channel : 'chrome',                // use system Chrome on GH runner
    headless: 'new',
    args    : ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });

  const map = await page.$$eval('article', arts => {
    const m = {};
    arts.forEach(a => {
      const link = a.querySelector('a.matchup-btn-link');
      if (!link) return;
      const id = link.href.match(/(\d+)$/)?.[1];
      const scores = Array.from(
        a.querySelectorAll('.covers-CoversMatchups-LiveScore')
      ).map(el => parseInt(el.textContent.trim(), 10));

      if (id && scores.length === 2)
        m[id] = { away: scores[0], home: scores[1] };
    });
    return m;
  });

  await browser.close();
  return map;   // { matchup_id: { away, home } }
}

/** scrape one box-score page – fallback when list page had no score */
async function scrapeBoxScore (browser, matchupId) {
  const url = `https://www.covers.com/sport/baseball/mlb/boxscore/${matchupId}`;
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });

    const scores = await page.$$eval(
      '.covers-CoversMatchups-LiveScore',
      els => els.slice(0, 2).map(el => parseInt(el.textContent.trim(), 10))
    );

    return scores.length === 2 ? { away: scores[0], home: scores[1] } : null;
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

/** master function: list page first, then box-score fallbacks */
async function scrapeScores (date, matchupIds) {
  const scoreById = await scrapeListPage(date);

  const missing = matchupIds.filter(id => !scoreById[id]);
  if (!missing.length) return scoreById;

  const browser = await puppeteer.launch({
    channel : 'chrome',
    headless: 'new',
    args    : ['--no-sandbox']
  });

  for (const id of missing) {
    const scr = await scrapeBoxScore(browser, id);
    if (scr) scoreById[id] = scr;
  }
  await browser.close();
  return scoreById;
}

/* ---------- main ------------------------------------------------------ */
async function gradeDailyBets () {
  if (!(await testConnection())) throw new Error('DB connection failed');
  const yDate = yesterdayCT();

  /* 1️⃣  load locked bets */
  const { data: bets, error: betErr } = await supabase
    .from('mlb_daily_bets')
    .select('*')
    .eq('game_date', yDate);

  if (betErr) throw betErr;
  if (!bets?.length) return console.log(`No bets to grade for ${yDate}`);

  /* 2️⃣  matchup meta */
  const { data: metas, error: metaErr } = await supabase
    .from('mlb_matchups')
    .select('matchup_id, home_team_id, away_team_id')
    .eq('game_date', yDate);

  if (metaErr) throw metaErr;
  const metaById = Object.fromEntries(metas.map(m => [m.matchup_id, m]));

  /* 3️⃣  scrape scores */
  const matchupIds = [...new Set(bets.map(b => b.matchup_id))];
  const scoreById  = await scrapeScores(yDate, matchupIds);

  /* 4️⃣  build result rows */
  const rows = bets.map(bet => {
    const meta  = metaById[bet.matchup_id];
    const score = scoreById[bet.matchup_id];
    if (!meta || !score) return null;

    const chosenIsHome = bet.team_id === meta.home_team_id;
    const win = chosenIsHome
      ? score.home > score.away
      : score.away > score.home;

    return {
      matchup_id : bet.matchup_id,
      game_date  : yDate,
      team_id    : bet.team_id,
      team_name  : bet.team_name,
      confidence : bet.confidence,
      moneyline  : bet.moneyline,
      stake      : bet.stake,
      to_win     : bet.to_win,
      profit_loss: win ? bet.to_win : -bet.stake,
      outcome    : win ? 'win' : 'loss'
    };
  }).filter(Boolean);

  if (!rows.length)
    return console.warn('No complete rows – likely missing scores/meta');

  /* 5️⃣  upsert results */
  const { error: insErr } = await supabase
    .from('mlb_daily_results')
    .upsert(rows, { onConflict: 'matchup_id,team_id' });

  if (insErr) throw insErr;
  console.log(`✅ Graded & saved ${rows.length} bets for ${yDate}`);
}

/* CLI entry */
if (import.meta.url.endsWith('gradeDailyBets.js')) {
  gradeDailyBets()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
