/*  Grade yesterday’s locked bets
    -----------------------------------------
    • Reads bets from public.mlb_daily_bets
    • Scrapes final scores from Covers.com
    • Saves P/L rows to public.mlb_daily_results
*/
//
import puppeteer from 'puppeteer';
import { supabase, testConnection } from './lib/supabaseClient.js';

/* --- helpers ----------------------------------------------------------- */
function yesterdayCT() {
  const ct = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
  );
  ct.setDate(ct.getDate() - 1);
  return ct.toISOString().slice(0, 10);          // YYYY-MM-DD
}

/* Scrape final scores from Covers */
async function scrapeScores(date) {
  const url = `https://www.covers.com/sports/mlb/matchups?selectedDate=${date}`;
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });

  const map = await page.$$eval('article.gamebox', boxes =>
    Object.fromEntries(
      boxes.map(box => {
        const href = box.querySelector('a.matchup-btn-link')?.href ?? '';
        const m    = href.match(/(\d+)$/);
        const scores = Array.from(box.querySelectorAll('.team-score'))
                      .map(el => parseInt(el.textContent.trim(), 10));
        return (m && scores.length === 2)
          ? [ m[1], { away: scores[0], home: scores[1] } ]
          : null;
      }).filter(Boolean)
    )
  );

  await browser.close();
  return map;     // { matchup_id: { away, home } }
}

/* --- main -------------------------------------------------------------- */
async function gradeDailyBets() {
  if (!(await testConnection())) throw new Error('DB connection failed');
  const yDate = yesterdayCT();

  /* 1️⃣  Fetch yesterday’s locked bets */
  const { data: bets, error: betErr } = await supabase
    .from('mlb_daily_bets')
    .select('*')
    .eq('game_date', yDate);

  if (betErr) throw betErr;
  if (!bets.length) {
    console.log(`No locked bets to grade for ${yDate}`);
    return;
  }

  /* 2️⃣  Fetch matchup meta (home/away IDs) */
  const { data: metas, error: metaErr } = await supabase
    .from('mlb_matchups')
    .select('matchup_id, home_team_id, away_team_id')
    .eq('game_date', yDate);

  if (metaErr) throw metaErr;

  const metaById = Object.fromEntries(metas.map(m => [m.matchup_id, m]));

  /* 3️⃣  Scrape final scores */
  const scoreById = await scrapeScores(yDate);

  /* 4️⃣  Assemble result rows */
  const rows = bets.map(bet => {
    const meta  = metaById[bet.matchup_id];
    const score = scoreById[bet.matchup_id];
    if (!meta || !score) return null;           // incomplete data

    const chosenIsHome = bet.team_id === meta.home_team_id;
    const win = chosenIsHome
      ? score.home > score.away
      : score.away > score.home;

    const profit_loss = win ? bet.to_win : -bet.stake;

    return {
      matchup_id   : bet.matchup_id,
      game_date    : yDate,
      team_id      : bet.team_id,
      team_name    : bet.team_name,
      confidence   : bet.confidence,
      moneyline    : bet.moneyline,
      stake        : bet.stake,
      to_win       : bet.to_win,
      profit_loss,
      outcome      : win ? 'win' : 'loss'
    };
  }).filter(Boolean);

  if (!rows.length) {
    console.warn('No complete rows to insert – abort.');
    return;
  }

  /* 5️⃣  Insert into mlb_daily_results */
  const { error: insErr } = await supabase
    .from('mlb_daily_results')
    .insert(rows);

  if (insErr) throw insErr;
  console.log(`✅ Graded ${rows.length} bets for ${yDate}`);
}

/* CLI entry */
if (import.meta.url.endsWith('gradeDailyBets.js')) {
  gradeDailyBets()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
