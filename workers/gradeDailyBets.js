/*  gradeDailyBets.js – meta-less grader with dual Covers selectors
    ----------------------------------------------------------------
    • Pulls every bet whose game_date < today
    • Scrapes each matchup’s box-score page (new + old markup)
    • Upserts graded rows into public.mlb_daily_results
    • Needs UNIQUE (matchup_id, team_id) on mlb_daily_results
*/

import puppeteer from 'puppeteer';
import { supabase, testConnection } from './lib/supabaseClient.js';

/* ───── 1)  team-name → 3-letter abbr map  ───── */
const NAME_TO_ABBR = {
  'ARIZONA DIAMONDBACKS': 'ARI', 'ARIZONA': 'ARI',
  'ATLANTA BRAVES': 'ATL', 'ATLANTA': 'ATL',
  'BALTIMORE ORIOLES': 'BAL', 'BALTIMORE': 'BAL',
  'BOSTON RED SOX': 'BOS', 'BOSTON': 'BOS',
  'CHICAGO WHITE SOX': 'CWS', 'CHI. WHITE SOX': 'CWS', 'WHITE SOX': 'CWS',
  'CHICAGO CUBS': 'CHC', 'CUBS': 'CHC',
  'CINCINNATI REDS': 'CIN', 'CINCINNATI': 'CIN',
  'CLEVELAND GUARDIANS': 'CLE', 'CLEVELAND': 'CLE',
  'COLORADO ROCKIES': 'COL', 'COLORADO': 'COL',
  'DETROIT TIGERS': 'DET', 'DETROIT': 'DET',
  'HOUSTON ASTROS': 'HOU', 'HOUSTON': 'HOU',
  'KANSAS CITY ROYALS': 'KCR', 'KANSAS CITY': 'KCR',
  'LOS ANGELES ANGELS': 'LAA', 'LA ANGELS': 'LAA',
  'LOS ANGELES DODGERS': 'LAD', 'LA DODGERS': 'LAD',
  'MIAMI MARLINS': 'MIA', 'MIAMI': 'MIA',
  'MILWAUKEE BREWERS': 'MIL', 'MILWAUKEE': 'MIL',
  'MINNESOTA TWINS': 'MIN', 'MINNESOTA': 'MIN',
  'NEW YORK METS': 'NYM', 'NY METS': 'NYM',
  'NEW YORK YANKEES': 'NYY', 'NY YANKEES': 'NYY',
  'OAKLAND ATHLETICS': 'OAK', 'OAKLAND': 'OAK',
  'PHILADELPHIA PHILLIES': 'PHI', 'PHILADELPHIA': 'PHI',
  'PITTSBURGH PIRATES': 'PIT', 'PITTSBURGH': 'PIT',
  'SAN DIEGO PADRES': 'SDP', 'SAN DIEGO': 'SDP',
  'SAN FRANCISCO GIANTS': 'SFG', 'SAN FRANCISCO': 'SFG',
  'SEATTLE MARINERS': 'SEA', 'SEATTLE': 'SEA',
  'ST. LOUIS CARDINALS': 'STL', 'ST LOUIS CARDINALS': 'STL', 'ST. LOUIS': 'STL',
  'TAMPA BAY RAYS': 'TBR', 'TAMPA BAY': 'TBR', 'TB RAYS': 'TBR',
  'TEXAS RANGERS': 'TEX', 'TEXAS': 'TEX',
  'TORONTO BLUE JAYS': 'TOR', 'TORONTO': 'TOR',
  'WASHINGTON NATIONALS': 'WSH', 'WASHINGTON': 'WSH',
  'CHICAGO WHITE SOX': 'CHW',
  'CHI. WHITE SOX'   : 'CHW',
  'WHITE SOX'        : 'CHW',

  'KANSAS CITY ROYALS': 'KC',
  'KANSAS CITY'       : 'KC',
  'ROYALS'            : 'KC',

  'TAMPA BAY RAYS': 'TB',
  'TAMPA BAY'     : 'TB',
  'TB RAYS'       : 'TB',
  'CHW': 'CHW',
  'CHI WHITE SOX': 'CHW',
  'CHI. WHITE SOX': 'CHW',
  'KC': 'KC', 'ROYALS': 'KC', 'KANSAS CITY':'KC',
  'TB': 'TB', 'TAMPA BAY':'TB',
};

/* ensure every 3-letter code maps to itself */
'ARI ATL BAL BOS CHC CIN CLE COL CWS DET HOU KCR LAA LAD MIA MIL MIN NYM NYY OAK PHI PIT SDP SFG SEA STL TBR TEX TOR WSH'
  .split(' ')
  .forEach(abbr => { NAME_TO_ABBR[abbr] = abbr; });

/* ───── 2)  utilities ───── */
const todayISO = () =>
  new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }).split(',')[0];

const launchChrome = () =>
  puppeteer.launch({ channel: 'chrome', headless: 'new', args: ['--no-sandbox'] });

/* ───── 3)  scrape one box-score page ───── */
async function scrapeBox(matchupId, browser) {
  const url = `https://www.covers.com/sport/baseball/mlb/boxscore/${matchupId}`;
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });

    /* newest layout */
    const head = await page.$('.covers-CoversMatchupDetails-leadIn');
    if (head) {
      const scores = await page.$$eval(
        '.covers-CoversMatchups-LiveScore',
        els => els.slice(0, 2).map(el => parseInt(el.textContent.trim(), 10))
      );
      const abbrs = await page.$$eval(
        '.covers-CoversMatchupDetails-awayName, .covers-CoversMatchupDetails-homeName',
        els => els.map(el => el.textContent.trim().toUpperCase())
      );
      if (scores.length === 2 && abbrs.length === 2)
        return { away_abbr: abbrs[0], home_abbr: abbrs[1], away: scores[0], home: scores[1] };
    }

    /* older fallback layout */
    const abbrs = await page.$$eval(
      'a.covers-CoversMatchups-uppercaseHelper',
      els => els.map(e => e.textContent.trim().toUpperCase()).slice(0, 2)
    );
    const nums = await page.$$eval(
      'td.covers-CoversMatchups-leagueAvgBg',
      els => els.map(e => parseInt(e.textContent.trim(), 10)).slice(-2)
    );
    return abbrs.length === 2 && nums.length === 2
      ? { away_abbr: abbrs[0], home_abbr: abbrs[1], away: nums[0], home: nums[1] }
      : null;
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

/* ───── 4)  main grading routine ───── */
async function gradeAll() {
  if (!(await testConnection())) throw new Error('DB connection failed');

  const { data: bets } = await supabase
  .from('mlb_daily_bets')
  .select('*')
  .lt('game_date', todayISO()); 

  if (!bets?.length) return console.log('Nothing to grade.');

  /* group by date */
  const byDate = bets.reduce((m, b) => {
    (m[b.game_date] = m[b.game_date] || []).push(b);
    return m;
  }, {});

  for (const gDate of Object.keys(byDate).sort()) {
    const dateBets = byDate[gDate];
    const browser = await launchChrome();

    /* scrape scores for every unique matchup */
    const scoreMap = {};
    for (const id of new Set(dateBets.map(b => b.matchup_id))) {
      const box = await scrapeBox(id, browser);
      if (box) scoreMap[id] = box;
    }
    await browser.close();

    /* build result rows */
    const rows = dateBets
      .map(bet => {
        const box = scoreMap[bet.matchup_id];
        if (!box) return null;

        const abbr = NAME_TO_ABBR[bet.team_name.toUpperCase()] ?? bet.team_name.toUpperCase();
        let win;
        if (abbr === box.home_abbr) win = box.home > box.away;
        else if (abbr === box.away_abbr) win = box.away > box.home;
        else return null; // alias missing

        return {
          matchup_id: bet.matchup_id,
          game_date : gDate,
          team_id   : bet.team_id,
          team_name : bet.team_name,
          confidence: bet.confidence,
          moneyline : bet.moneyline,
          stake     : bet.stake,
          to_win    : bet.to_win,
          profit_loss: win ? bet.to_win : -bet.stake,
          outcome   : win ? 'win' : 'loss'
        };
      })
      .filter(Boolean);

    /* nothing graded ⇒ print debug table & skip */
    if (!rows.length) {
      console.table(
        dateBets.map(b => {
          const bx = scoreMap[b.matchup_id];
          return {
            matchup_id: b.matchup_id,
            bet_name : b.team_name,
            map_abbr : (NAME_TO_ABBR[b.team_name.toUpperCase()] ?? b.team_name).toUpperCase(),
            box_home : bx?.home_abbr,
            box_away : bx?.away_abbr,
            scores   : bx ? `${bx.away}-${bx.home}` : 'NO SCORES'
          };
        })
      );
      console.log(`⚠️  ${gDate}: nothing graded (team map or scores missing)`);
      continue; // <- stay inside loop
    }

    /* upsert results */
    const { error } = await supabase
      .from('mlb_daily_results')
      .upsert(rows, { onConflict: 'matchup_id,team_id' });

    if (error) console.error(`❌ ${gDate}:`, error.message);
    else console.log(`✅ ${gDate}: graded ${rows.length} bets`);
  }
}

/* ───── 5)  CLI entry ───── */
if (import.meta.url.endsWith('gradeDailyBets.js')) {
  gradeAll()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
