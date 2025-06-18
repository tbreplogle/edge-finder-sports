/*  gradeDailyBets.js
    -----------------------------------------------------------------------
    Grades every locked bet whose game_date is in the past using only
    data from `mlb_daily_bets` and Covers-box-score pages.

    • No dependency on mlb_matchups table
    • One scrape per unique matchup_id (box-score URL)
    • Upserts results into public.mlb_daily_results
    • Designed for GitHub Actions runner  (uses system Chrome)
*/

import puppeteer from 'puppeteer';
import { supabase, testConnection } from './lib/supabaseClient.js';

/* ────────────────────────────────────────────────────────────────────── *
 * 1)  Helpers                                                           *
 * ────────────────────────────────────────────────────────────────────── */
const CT_TZ = 'America/Chicago';
const todayISO = () =>
  new Date(new Date().toLocaleString('en-US', { timeZone: CT_TZ }))
    .toISOString()
    .slice(0, 10); // YYYY-MM-DD

/* Long/short team names → 3-letter betting abbreviations */
const NAME_TO_ABBR = {
  'ARIZONA': 'ARI', 'ARIZONA DIAMONDBACKS': 'ARI',
  'ATLANTA': 'ATL', 'ATLANTA BRAVES': 'ATL',
  'BALTIMORE': 'BAL', 'BALTIMORE ORIOLES': 'BAL',
  'BOSTON': 'BOS', 'BOSTON RED SOX': 'BOS',
  'CHI. WHITE SOX': 'CWS', 'CHICAGO WHITE SOX': 'CWS',
  'CHICAGO CUBS': 'CHC', 'CUBS': 'CHC',
  'CINCINNATI': 'CIN', 'CINCINNATI REDS': 'CIN',
  'CLEVELAND': 'CLE', 'CLEVELAND GUARDIANS': 'CLE',
  'COLORADO': 'COL', 'COLORADO ROCKIES': 'COL',
  'DETROIT': 'DET', 'DETROIT TIGERS': 'DET',
  'HOUSTON': 'HOU', 'HOUSTON ASTROS': 'HOU',
  'KANSAS CITY': 'KCR', 'KANSAS CITY ROYALS': 'KCR',
  'LA ANGELS': 'LAA', 'LOS ANGELES ANGELS': 'LAA',
  'LA DODGERS': 'LAD', 'LOS ANGELES DODGERS': 'LAD',
  'MIAMI': 'MIA', 'MIAMI MARLINS': 'MIA',
  'MILWAUKEE': 'MIL', 'MILWAUKEE BREWERS': 'MIL',
  'MINNESOTA': 'MIN', 'MINNESOTA TWINS': 'MIN',
  'NY METS': 'NYM', 'NEW YORK METS': 'NYM',
  'NY YANKEES': 'NYY', 'NEW YORK YANKEES': 'NYY',
  'OAKLAND': 'OAK', 'OAKLAND ATHLETICS': 'OAK',
  'PHILADELPHIA': 'PHI', 'PHILADELPHIA PHILLIES': 'PHI',
  'PITTSBURGH': 'PIT', 'PITTSBURGH PIRATES': 'PIT',
  'SAN DIEGO': 'SDP', 'SAN DIEGO PADRES': 'SDP',
  'SAN FRANCISCO': 'SFG', 'SAN FRANCISCO GIANTS': 'SFG',
  'SEATTLE': 'SEA', 'SEATTLE MARINERS': 'SEA',
  'ST. LOUIS': 'STL', 'ST LOUIS CARDINALS': 'STL', 'ST. LOUIS CARDINALS': 'STL',
  'TAMPA BAY': 'TBR', 'TAMPA BAY RAYS': 'TBR',
  'TEXAS': 'TEX', 'TEXAS RANGERS': 'TEX',
  'TORONTO': 'TOR', 'TORONTO BLUE JAYS': 'TOR',
  'WASHINGTON': 'WSH', 'WASHINGTON NATIONALS': 'WSH'
};

/* ────────────────────────────────────────────────────────────────────── *
 * 2)  Scraping helpers                                                  *
 * ────────────────────────────────────────────────────────────────────── */
const launchChrome = () =>
  puppeteer.launch({
    channel: 'chrome',          // uses runner’s system Chrome
    headless: 'new',
    args: ['--no-sandbox']
  });

async function scrapeBoxScore(matchupId, browser) {
  const url = `https://www.covers.com/sport/baseball/mlb/boxscore/${matchupId}`;
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const data = await page.$$eval(
      '.covers-CoversMatchupDetails-leadIn',
      (rows) => {
        const row = rows[0];
        if (!row) return null;

        const scores = Array.from(
          row.querySelectorAll('.covers-CoversMatchups-LiveScore')
        ).map((n) => parseInt(n.textContent.trim(), 10));

        const names = Array.from(
          row.querySelectorAll(
            '.covers-CoversMatchupDetails-awayName, .covers-CoversMatchupDetails-homeName'
          )
        ).map((n) => n.textContent.trim().toUpperCase());

        return scores.length === 2 && names.length === 2
          ? {
              away_abbr: names[0],
              home_abbr: names[1],
              away: scores[0],
              home: scores[1]
            }
          : null;
      }
    );
    return data;
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

/* ────────────────────────────────────────────────────────────────────── *
 * 3)  Grading logic for a single date                                   *
 * ────────────────────────────────────────────────────────────────────── */
async function gradeDate(gameDate, betsOnDate) {
  const browser = await launchChrome();

  /* fetch scores for unique matchup_ids */
  const scoreById = {};
  for (const id of new Set(betsOnDate.map((b) => b.matchup_id))) {
    const s = await scrapeBoxScore(id, browser);
    if (s) scoreById[id] = s;
  }
  await browser.close();

  /* build result rows */
  const rows = betsOnDate
    .map((bet) => {
      const box = scoreById[bet.matchup_id];
      if (!box) return null;

      const betAbbr =
        NAME_TO_ABBR[bet.team_name.toUpperCase()] ??
        bet.team_name.toUpperCase();

      let win;
      if (betAbbr === box.home_abbr) win = box.home > box.away;
      else if (betAbbr === box.away_abbr) win = box.away > box.home;
      else return null; // could not map team

      return {
        matchup_id: bet.matchup_id,
        game_date: gameDate,
        team_id: bet.team_id,
        team_name: bet.team_name,
        confidence: bet.confidence,
        moneyline: bet.moneyline,
        stake: bet.stake,
        to_win: bet.to_win,
        profit_loss: win ? bet.to_win : -bet.stake,
        outcome: win ? 'win' : 'loss'
      };
    })
    .filter(Boolean);

  if (!rows.length) {
    console.log(`⚠️  ${gameDate}: nothing graded (missing scores or team map)`);
    return;
  }

  const { error } = await supabase
    .from('mlb_daily_results')
    .upsert(rows, { onConflict: 'matchup_id,team_id' });

  if (error) console.error(`❌ ${gameDate}:`, error.message);
  else console.log(`✅ ${gameDate}: graded ${rows.length} bets`);
}

/* ────────────────────────────────────────────────────────────────────── *
 * 4)  Main: grade all past-dated bets                                   *
 * ────────────────────────────────────────────────────────────────────── */
async function gradeAllPast() {
  if (!(await testConnection()))
    throw new Error('Supabase connection failed');

  const { data: bets, error } = await supabase
    .from('mlb_daily_bets')
    .select('*')
    .lt('game_date', todayISO());

  if (error) throw error;
  if (!bets?.length) return console.log('No past bets to grade.');

  /* group by game_date */
  const byDate = bets.reduce((m, b) => {
    (m[b.game_date] ||= []).push(b);
    return m;
  }, {});

  for (const date of Object.keys(byDate).sort()) {
    await gradeDate(date, byDate[date]);
  }
}

/* ────────────────────────────────────────────────────────────────────── *
 * 5)  CLI entry                                                         *
 * ────────────────────────────────────────────────────────────────────── */
if (import.meta.url.endsWith('gradeDailyBets.js')) {
  gradeAllPast()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
