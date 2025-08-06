// workers/fetchLineMovement.js

import puppeteer from 'puppeteer';
import { supabase, testConnection } from './lib/supabaseClient.js';

/** ─── full team-name ⇒ 3-letter map ─── */
const NAME_TO_ABBR = {
  'ARIZONA DIAMONDBACKS': 'ARI', 'ARIZONA': 'ARI', 'DIAMONDBACKS': 'ARI',
  'ATLANTA BRAVES'      : 'ATL', 'ATLANTA': 'ATL', 'BRAVES': 'ATL',
  'BALTIMORE ORIOLES'   : 'BAL', 'BALTIMORE': 'BAL', 'ORIOLES': 'BAL',
  'BOSTON RED SOX'      : 'BOS', 'BOSTON': 'BOS', 'RED SOX': 'BOS',
  'CHICAGO WHITE SOX'   : 'CWS', 'CHI WHITE SOX': 'CWS', 'CHI. WHITE SOX': 'CWS',
  'CHICAGO CUBS'        : 'CHC', 'CHI CUBS': 'CHC',
  'CINCINNATI REDS'     : 'CIN', 'CINCINNATI': 'CIN',
  'CLEVELAND GUARDIANS' : 'CLE', 'CLEVELAND': 'CLE',
  'COLORADO ROCKIES'    : 'COL', 'COLORADO': 'COL',
  'DETROIT TIGERS'      : 'DET', 'DETROIT': 'DET',
  'HOUSTON ASTROS'      : 'HOU', 'HOUSTON': 'HOU',
  'KANSAS CITY ROYALS'  : 'KCR', 'KANSAS CITY': 'KCR', 'ROYALS': 'KCR',
  'LOS ANGELES ANGELS'  : 'LAA', 'LA ANGELS': 'LAA', 'ANGELS': 'LAA',
  'LOS ANGELES DODGERS' : 'LAD', 'LA DODGERS': 'LAD', 'DODGERS': 'LAD',
  'MIAMI MARLINS'       : 'MIA', 'MIAMI': 'MIA', 'MARLINS': 'MIA',
  'MILWAUKEE BREWERS'   : 'MIL', 'MILWAUKEE': 'MIL', 'BREWERS': 'MIL',
  'MINNESOTA TWINS'     : 'MIN', 'MINNESOTA': 'MIN', 'TWINS': 'MIN',
  'NEW YORK METS'       : 'NYM', 'NY METS': 'NYM', 'METS': 'NYM',
  'NEW YORK YANKEES'    : 'NYY','NY YANKEES': 'NYY','YANKEES': 'NYY',
  'OAKLAND ATHLETICS'   : 'OAK', 'OAKLAND': 'OAK', 'ATHLETICS': 'OAK',
  'PHILADELPHIA PHILLIES': 'PHI','PHILADELPHIA': 'PHI','PHILLIES': 'PHI',
  'PITTSBURGH PIRATES'  : 'PIT', 'PITTSBURGH': 'PIT','PIRATES': 'PIT',
  'SAN DIEGO PADRES'    : 'SDP', 'SAN DIEGO': 'SDP','PADRES': 'SDP',
  'SAN FRANCISCO GIANTS': 'SFG', 'SAN FRANCISCO': 'SFG','GIANTS': 'SFG',
  'SEATTLE MARINERS'    : 'SEA', 'SEATTLE': 'SEA','MARINERS': 'SEA',
  'ST. LOUIS CARDINALS' : 'STL', 'ST LOUIS CARDINALS': 'STL','ST. LOUIS': 'STL','CARDINALS':'STL',
  'TAMPA BAY RAYS'      : 'TBR', 'TAMPA BAY': 'TBR','TB RAYS':'TBR','RAYS':'TBR',
  'TEXAS RANGERS'       : 'TEX', 'TEXAS': 'TEX','RANGERS':'TEX',
  'TORONTO BLUE JAYS'   : 'TOR', 'TORONTO': 'TOR','BLUE JAYS':'TOR',
  'WASHINGTON NATIONALS': 'WSH', 'WASHINGTON':'WSH','NATIONALS':'WSH'
};

/** ─── extra short / odd codes ─── */
Object.assign(NAME_TO_ABBR, {
  CH  : 'CHC', CU  : 'CHC', CUBS: 'CHC',
  WHT : 'CWS', CHW : 'CWS', STL : 'STL',
  AZ  : 'ARI', ARZ : 'ARI', BO  : 'BOS',
  KC  : 'KCR', TB  : 'TBR', SD  : 'SDP',
  SF  : 'SFG', NYK : 'NYY', WAS : 'WSH',
  ATH : 'OAK', 'ST LOUIS': 'STL','SAINT LOUIS':'STL',
  // explicit self-maps
  OAK : 'OAK', BOS : 'BOS', NYY: 'NYY'
});

/** ─── finally, map every 3-letter code to itself ─── */
'ARI ATL BAL BOS CHC CIN CLE COL CWS DET HOU KCR LAA LAD MIA MIL MIN NYM NYY OAK PHI PIT SDP SFG SEA STL TBR TEX TOR WSH'
  .split(/\s+/).forEach(code => { NAME_TO_ABBR[code] = code; });


const THRILLZZ_SEL = '.covers-CoversOdds-lineMovementTable tbody tr';
const AMERICAN_SEL  = 'div.American';

async function scrapeLines(matchupId, awayCode, homeCode, browser) {
  const slug = `${awayCode.toLowerCase()}-at-${homeCode.toLowerCase()}`;
  const url  = `https://www.covers.com/sport/baseball/mlb/linemovement/${slug}/${matchupId}`;
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const rows = await page.$$(THRILLZZ_SEL);
    if (!rows.length) return null;

    const data = [];
    for (let row of rows) {
      const tsText = await row.$eval('td:first-child div', el => el.textContent);
      const ts = new Date(tsText.replace(/\(ET\)/,'') + ' ET');

      const [awayLine, homeLine] = await Promise.all([
        row.$eval(`td:nth-child(2) ${AMERICAN_SEL}`, el => parseInt(el.textContent.trim(), 10)),
        row.$eval(`td:nth-child(3) ${AMERICAN_SEL}`, el => parseInt(el.textContent.trim(), 10))
      ]);

      data.push({ ts, awayLine, homeLine });
    }

    // Thrillzz table is newest-first, so last = earliest, first = latest
    const first = data[data.length - 1];
    const last  = data[0];

    return {
      away: { time_min: first.ts,    line_min: first.awayLine,
              time_max: last.ts,     line_max: last.awayLine },
      home: { time_min: first.ts,    line_min: first.homeLine,
              time_max: last.ts,     line_max: last.homeLine }
    };
  } catch (err) {
    console.error('❌ scrapeLines', matchupId, err.message);
    return null;
  } finally {
    await page.close();
  }
}

async function fetchAllCLV() {
  if (!(await testConnection())) throw new Error('DB connection failed');

  // adjust your date filter as needed
  const today = new Date().toISOString().slice(0,10);
  const { data: bets, error } = await supabase
    .from('mlb_daily_bets')
    .select('matchup_id, team_id, team_name, away_code, home_code, game_date')
    .eq('game_date', today);

  if (error) throw error;
  if (!bets.length) {
    console.log('No bets for', today);
    return;
  }

  const browser = await puppeteer.launch({ channel:'chrome', headless:'new', args:['--no-sandbox'] });

  for (let b of bets) {
    const lines = await scrapeLines(b.matchup_id, b.away_code, b.home_code, browser);
    if (!lines) continue;

    // upsert away
    await supabase.from('mlb_line_movements').upsert({
      matchup_id:   b.matchup_id,
      team_id:      b.team_id,       // ensure this matches away_code’s team_id
      game_date:    b.game_date,
      source:       'Thrillzz',
      line_time_min: lines.away.time_min,
      line_min:     lines.away.line_min,
      line_time_max: lines.away.time_max,
      line_max:     lines.away.line_max
    }, { onConflict: 'matchup_id,team_id,source' });

    // upsert home
    await supabase.from('mlb_line_movements').upsert({
      matchup_id:   b.matchup_id,
      team_id:      b.home_code === b.team_name ? b.team_id : null, 
                                     // or adjust to pull home_team_id from your schema
      game_date:    b.game_date,
      source:       'Thrillzz',
      line_time_min: lines.home.time_min,
      line_min:     lines.home.line_min,
      line_time_max: lines.home.time_max,
      line_max:     lines.home.line_max
    }, { onConflict: 'matchup_id,team_id,source' });
  }

  await browser.close();
}

if (import.meta.url.endsWith('fetchLineMovement.js')) {
  fetchAllCLV()
    .then(() => process.exit(0))
    .catch(e => { console.error(e); process.exit(1); });
}
