/*  gradeDailyBets.js – meta-less grader with dual Covers selectors
    ----------------------------------------------------------------
    • Pulls every bet whose game_date < today
    • Scrapes each matchup’s box-score page (new + old markup)
    • Upserts graded rows into public.mlb_daily_results
    • Needs UNIQUE (matchup_id, team_id) on mlb_daily_results
*/

import puppeteer from 'puppeteer';
import { supabase, testConnection } from './lib/supabaseClient.js';

/* ───── 1)  team-name → 3-letter abbreviation map  ───── */

/* ───── 1)  team-name ⇒ 3-letter abbreviation map  ───── */

const NAME_TO_ABBR = {
  /* full team names (and the most common variants) */
  'ARIZONA DIAMONDBACKS': 'ARI', 'ARIZONA'              : 'ARI', 'DIAMONDBACKS' : 'ARI',
  'ATLANTA BRAVES'      : 'ATL', 'ATLANTA'              : 'ATL', 'BRAVES'       : 'ATL',
  'BALTIMORE ORIOLES'   : 'BAL', 'BALTIMORE'            : 'BAL', 'ORIOLES'      : 'BAL',
  'BOSTON RED SOX'      : 'BOS', 'BOSTON'               : 'BOS', 'RED SOX'      : 'BOS',
  'CHICAGO WHITE SOX' : 'CWS', 'CHI WHITE SOX' : 'CWS', 'CHI. WHITE SOX': 'CWS',
  'CHICAGO CUBS'        : 'CHC', 'CHI CUBS'             : 'CHC',
  'CINCINNATI REDS'     : 'CIN', 'CINCINNATI'           : 'CIN',
  'CLEVELAND GUARDIANS' : 'CLE', 'CLEVELAND'            : 'CLE',
  'COLORADO ROCKIES'    : 'COL', 'COLORADO'             : 'COL',
  'DETROIT TIGERS'      : 'DET', 'DETROIT'              : 'DET',
  'HOUSTON ASTROS'      : 'HOU', 'HOUSTON'              : 'HOU',
  'KANSAS CITY ROYALS'  : 'KCR', 'KANSAS CITY'          : 'KCR', 'ROYALS' : 'KCR',
  'LOS ANGELES ANGELS'  : 'LAA', 'LA ANGELS'            : 'LAA', 'ANGELS' : 'LAA',
  'LOS ANGELES DODGERS' : 'LAD', 'LA DODGERS'           : 'LAD', 'DODGERS': 'LAD',
  'MIAMI MARLINS'       : 'MIA', 'MIAMI'                : 'MIA', 'MARLINS': 'MIA',
  'MILWAUKEE BREWERS'   : 'MIL', 'MILWAUKEE'            : 'MIL', 'BREWERS': 'MIL',
  'MINNESOTA TWINS'     : 'MIN', 'MINNESOTA'            : 'MIN', 'TWINS'  : 'MIN',
  'NEW YORK METS'       : 'NYM', 'NY METS'              : 'NYM', 'METS'   : 'NYM',
  'NEW YORK YANKEES'    : 'NYY', 'NY YANKEES'           : 'NYY', 'YANKEES': 'NYY',
  'OAKLAND ATHLETICS'   : 'OAK', 'OAKLAND'              : 'OAK', 'ATHLETICS' : 'OAK',
  'PHILADELPHIA PHILLIES': 'PHI','PHILADELPHIA'         : 'PHI', 'PHILLIES': 'PHI',
  'PITTSBURGH PIRATES'  : 'PIT', 'PITTSBURGH'           : 'PIT', 'PIRATES' : 'PIT',
  'SAN DIEGO PADRES'    : 'SDP', 'SAN DIEGO'            : 'SDP', 'PADRES'  : 'SDP',
  'SAN FRANCISCO GIANTS': 'SFG', 'SAN FRANCISCO'        : 'SFG', 'GIANTS'  : 'SFG',
  'SEATTLE MARINERS'    : 'SEA', 'SEATTLE'              : 'SEA', 'MARINERS': 'SEA',
  'ST. LOUIS CARDINALS' : 'STL', 'ST LOUIS CARDINALS'   : 'STL', 'ST. LOUIS': 'STL', 'CARDINALS':'STL',
  'TAMPA BAY RAYS'      : 'TBR', 'TAMPA BAY'            : 'TBR', 'TB RAYS': 'TBR', 'RAYS':'TBR',
  'TEXAS RANGERS'       : 'TEX', 'TEXAS'                : 'TEX', 'RANGERS': 'TEX',
  'TORONTO BLUE JAYS'   : 'TOR', 'TORONTO'              : 'TOR', 'BLUE JAYS':'TOR',
  'WASHINGTON NATIONALS': 'WSH', 'WASHINGTON'           : 'WSH', 'NATIONALS':'WSH'
};

/* -------------------------------------------------------------
 * Extra short / odd codes we’ve seen in Covers linescore tables
 * ----------------------------------------------------------- */
Object.assign(NAME_TO_ABBR, {
  /* Cubs / White-Sox oddities */
  CH  : 'CHC',   // two-letter “CH”
  CU  : 'CHC',   // “CU”
  CUBS: 'CHC',
  WHT : 'CWS',          // “WHT” = White Sox
  CHW : 'CWS',          // Covers often uses CHW

  /* 2-letter or legacy codes */
  AZ  : 'ARI', ARZ : 'ARI',
  BO  : 'BOS',
  KC  : 'KCR',
  TB  : 'TBR',
  SD  : 'SDP',
  SF  : 'SFG',
  NYK : 'NYY',   // sometimes on tables for Yankees
  WAS : 'WSH',
  ATH : 'OAK',

  /* self-maps to be explicit */
  OAK : 'OAK', BOS : 'BOS', NYY:'NYY'
});

/* finally, ensure every standard 3-letter code maps to itself */
'ARI ATL BAL BOS CHC CIN CLE COL CWS DET HOU KCR LAA LAD MIA MIL MIN \
 NYM NYY OAK PHI PIT SDP SFG SEA STL TBR TEX TOR WSH'
  .split(/\s+/)
  .forEach(code => { NAME_TO_ABBR[code] = code; });


/* ───── 2)  utilities ───── */
const todayISO = () =>
  new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }).split(',')[0];

const launchChrome = () =>
  puppeteer.launch({ channel: 'chrome', headless: 'new', args: ['--no-sandbox'] });

/* ───── 3) scrape one box-score page ───── */
async function scrapeBox(matchupId, browser) {
  const url = `https://www.covers.com/sport/baseball/mlb/boxscore/${matchupId}`;
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });

    /* ── LAYOUT A: “LiveScore--left / --right” columns ── */
    const leftSel  = '.covers-CoversMatchups-LiveScore--left';
    const rightSel = '.covers-CoversMatchups-LiveScore--right';

    const leftEl  = await page.$(leftSel);
    const rightEl = await page.$(rightSel);

    if (leftEl && rightEl) {
      /* wait until both contain at least one digit (max 5 s) */
      await page.waitForFunction(
        (l, r) => /\d/.test(l.textContent) && /\d/.test(r.textContent),
        { timeout: 5000 },
        leftEl, rightEl
      ).catch(() => {});              // ignore timeout – we’ll still try

      const sHome = parseInt(await page.evaluate(el => el.textContent, rightEl), 10);
      const sAway = parseInt(await page.evaluate(el => el.textContent, leftEl ), 10);

      const abbrs = await page.$$eval(
        '.covers-CoversMatchupDetails-awayName, .covers-CoversMatchupDetails-homeName',
        els => els.map(e => e.textContent.trim().toUpperCase())
      ); // [away, home]

      if (abbrs.length === 2 && !Number.isNaN(sHome) && !Number.isNaN(sAway)) {
        return { away_abbr: abbrs[0], home_abbr: abbrs[1], away: sAway, home: sHome };
      }
    }

    /* ── LAYOUT B: headline score “covers-CoversMatchups-LiveScore” list ── */
    const scores2 = await page.$$eval(
      '.covers-CoversMatchups-LiveScore',
      els => els.slice(0, 2).map(el => parseInt(el.textContent.trim(), 10))
    );

    if (scores2.length === 2 && !scores2.some(Number.isNaN)) {
      const abbrs = await page.$$eval(
        '.covers-CoversMatchupDetails-awayName, .covers-CoversMatchupDetails-homeName',
        els => els.map(e => e.textContent.trim().toUpperCase())
      ); // [away, home]
      if (abbrs.length === 2) {
        return { away_abbr: abbrs[0], home_abbr: abbrs[1],
                 away: scores2[0], home: scores2[1] };
      }
    }

    /* ── LAYOUT C: old table (leagueAvgBg) ── */
/* older fallback layout --------------------------------------- */
const abbrsOld = await page.$$eval(
  'a.covers-CoversMatchups-uppercaseHelper',
  els => els.map(e => e.textContent.trim().toUpperCase()).slice(0, 2)
);

const numsOld = await page.$$eval(
  'td.covers-CoversMatchups-leagueAvgBg,             \
   td.covers-CoversMatchups-linescoreTable--total',  // <-- add this
  els => els.map(e => parseInt(e.textContent.trim(), 10)).slice(-2)
);

if (abbrsOld.length === 2 && numsOld.length === 2 && !numsOld.some(Number.isNaN)) {
  return { away_abbr: abbrsOld[0], home_abbr: abbrsOld[1], away: numsOld[0], home: numsOld[1] };
}

    /* ── LAYOUT D: deep table selectors (last-column totals) ── */
    try {
      const deepAwaySel  =
        'div.covers-CoversMatchups-responsiveTableContainer > table > tbody > tr:nth-child(1) > td:nth-child(11)';
      const deepHomeSel  =
        'div.covers-CoversMatchups-responsiveTableContainer > table > tbody > tr:nth-child(2) > td:nth-child(11)';

      await page.waitForSelector(deepAwaySel, { timeout: 3000 });
      await page.waitForSelector(deepHomeSel, { timeout: 3000 });

      const sAwayDeep = parseInt(await page.$eval(deepAwaySel, el => el.textContent.trim()), 10);
      const sHomeDeep = parseInt(await page.$eval(deepHomeSel, el => el.textContent.trim()), 10);

      const abbrsDeep = await page.$$eval(
        '.covers-CoversMatchupDetails-awayName, .covers-CoversMatchupDetails-homeName',
        els => els.map(e => e.textContent.trim().toUpperCase())
      ); // [away, home]

      if (
        abbrsDeep.length === 2 &&
        !Number.isNaN(sAwayDeep) &&
        !Number.isNaN(sHomeDeep)
      ) {
        return {
          away_abbr: abbrsDeep[0],
          home_abbr: abbrsDeep[1],
          away: sAwayDeep,
          home: sHomeDeep
        };
      }
    } catch (_) {
      /* ignore – fall through to next fallback */
    }

    /* still nothing – print one-line debug */
    console.log(`⚠️  No score scraped for matchup ${matchupId}`);

    return null;
  } catch (err) {
    console.error(`❌ scrapeBox(${matchupId})`, err.message);
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
  .lt('game_date', todayISO())
  .not('matchup_id', 'in', `(${Object.keys(await supabase
      .from('mlb_daily_results')
      .select('matchup_id')
      .lt('game_date', todayISO()))
     .map(row => `'${row.matchup_id}'`)
     .join(',') || "''"})`);


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

        const raw  = bet.team_name.toUpperCase().replace(/\./g,'').replace(/\s+/g,' ').trim();
        const abbr = NAME_TO_ABBR[raw] ?? raw;
                /* ✨ new: canonicalise box abbreviations too */
                const homeAbbr = NAME_TO_ABBR[box.home_abbr] ?? box.home_abbr;
                const awayAbbr = NAME_TO_ABBR[box.away_abbr] ?? box.away_abbr;
        
                let win;
                if (abbr === homeAbbr)      win = box.home > box.away;
               else if (abbr === awayAbbr) win = box.away > box.home;
                else return null;           // alias still missing

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
