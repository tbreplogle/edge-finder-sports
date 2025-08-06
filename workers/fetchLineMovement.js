// workers/fetchLineMovement.js

import puppeteer from 'puppeteer';
import { supabase, testConnection } from './lib/supabaseClient.js';

/** ─── your full NAME_TO_ABBR map ─── */
const NAME_TO_ABBR = {
  'ARIZONA DIAMONDBACKS': 'ARI','ARIZONA':'ARI','DIAMONDBACKS':'ARI',
  'ATLANTA BRAVES':'ATL','ATLANTA':'ATL','BRAVES':'ATL',
  'BALTIMORE ORIOLES':'BAL','BALTIMORE':'BAL','ORIOLES':'BAL',
  'BOSTON RED SOX':'BOS','BOSTON':'BOS','RED SOX':'BOS',
  'CHICAGO WHITE SOX':'CWS','CHI WHITE SOX':'CWS','CHI. WHITE SOX':'CWS',
  'CHICAGO CUBS':'CHC','CHI CUBS':'CHC',
  'CINCINNATI REDS':'CIN','CINCINNATI':'CIN',
  'CLEVELAND GUARDIANS':'CLE','CLEVELAND':'CLE',
  'COLORADO ROCKIES':'COL','COLORADO':'COL',
  'DETROIT TIGERS':'DET','DETROIT':'DET',
  'HOUSTON ASTROS':'HOU','HOUSTON':'HOU',
  'KANSAS CITY ROYALS':'KCR','KANSAS CITY':'KCR','ROYALS':'KCR',
  'LOS ANGELES ANGELS':'LAA','LA ANGELS':'LAA','ANGELS':'LAA',
  'LOS ANGELES DODGERS':'LAD','LA DODGERS':'LAD','DODGERS':'LAD',
  'MIAMI MARLINS':'MIA','MIAMI':'MIA','MARLINS':'MIA',
  'MILWAUKEE BREWERS':'MIL','MILWAUKEE':'MIL','BREWERS':'MIL',
  'MINNESOTA TWINS':'MIN','MINNESOTA':'MIN','TWINS':'MIN',
  'NEW YORK METS':'NYM','NY METS':'NYM','METS':'NYM',
  'NEW YORK YANKEES':'NYY','NY YANKEES':'NYY','YANKEES':'NYY',
  'OAKLAND ATHLETICS':'OAK','OAKLAND':'OAK','ATHLETICS':'OAK',
  'PHILADELPHIA PHILLIES':'PHI','PHILADELPHIA':'PHI','PHILLIES':'PHI',
  'PITTSBURGH PIRATES':'PIT','PITTSBURGH':'PIT','PIRATES':'PIT',
  'SAN DIEGO PADRES':'SDP','SAN DIEGO':'SDP','PADRES':'SDP',
  'SAN FRANCISCO GIANTS':'SFG','SAN FRANCISCO':'SFG','GIANTS':'SFG',
  'SEATTLE MARINERS':'SEA','SEATTLE':'SEA','MARINERS':'SEA',
  'ST. LOUIS CARDINALS':'STL','ST LOUIS CARDINALS':'STL','ST. LOUIS':'STL','CARDINALS':'STL',
  'TAMPA BAY RAYS':'TBR','TAMPA BAY':'TBR','TB RAYS':'TBR','RAYS':'TBR',
  'TEXAS RANGERS':'TEX','TEXAS':'TEX','RANGERS':'TEX',
  'TORONTO BLUE JAYS':'TOR','TORONTO':'TOR','BLUE JAYS':'TOR',
  'WASHINGTON NATIONALS':'WSH','WASHINGTON':'WSH','NATIONALS':'WSH',
  // extras
  CH:'CHC',CU:'CHC',CUBS:'CHC',WHT:'CWS',CHW:'CWS',STL:'STL',
  AZ:'ARI',ARZ:'ARI',BO:'BOS',KC:'KCR',TB:'TBR',SD:'SDP',
  SF:'SFG',NYK:'NYY',WAS:'WSH',ATH:'OAK','ST LOUIS':'STL','SAINT LOUIS':'STL',
  OAK:'OAK',BOS:'BOS',NYY:'NYY'
};
'ARI ATL BAL BOS CHC CIN CLE COL CWS DET HOU KCR LAA LAD MIA MIL MIN NYM NYY OAK PHI PIT SDP SFG SEA STL TBR TEX TOR WSH'
  .split(/\s+/).forEach(c => NAME_TO_ABBR[c] = c);

/** ─── selectors ─── */
const BOX_LEFT_SEL  = '.covers-CoversMatchups-LiveScore--left';
const BOX_RIGHT_SEL = '.covers-CoversMatchups-LiveScore--right';
const LINE_ROW_SEL  = '.covers-CoversOdds-lineMovementTable tbody tr';
const AM_SEL        = 'div.American';

/**
 * 1) scrapeBox: pull away_abbr/home_abbr from boxscore page
 */
async function scrapeBox(matchupId, browser) {
  const url = `https://www.covers.com/sport/baseball/mlb/boxscore/${matchupId}`;
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil:'domcontentloaded', timeout:45_000 });

    // layout A
    const left  = await page.$(BOX_LEFT_SEL);
    const right = await page.$(BOX_RIGHT_SEL);
    if (left && right) {
      await page.waitForFunction(
        (l,r)=>/\d/.test(l.textContent)&&/\d/.test(r.textContent),
        { timeout:5_000 }, left, right
      ).catch(()=>{});
      const sAway = parseInt(await page.evaluate(el=>el.textContent, left),10);
      const sHome = parseInt(await page.evaluate(el=>el.textContent, right),10);
      const names = await page.$$eval(
        '.covers-CoversMatchupDetails-awayName, .covers-CoversMatchupDetails-homeName',
        els => els.map(e=>e.textContent.trim().toUpperCase())
      );
      if (names.length===2 && !isNaN(sAway)&&!isNaN(sHome)) {
        return { away_abbr: names[0], home_abbr: names[1] };
      }
    }

    // fallback B
    const scores = await page.$$eval(
      '.covers-CoversMatchups-LiveScore',
      els => els.slice(0,2).map(e=>parseInt(e.textContent.trim(),10))
    );
    if (scores.length===2) {
      const names = await page.$$eval(
        '.covers-CoversMatchupDetails-awayName, .covers-CoversMatchupDetails-homeName',
        els => els.map(e=>e.textContent.trim().toUpperCase())
      );
      if (names.length===2) {
        return { away_abbr: names[0], home_abbr: names[1] };
      }
    }

    console.warn(`⚠️ box scrape failed for ${matchupId}`);
    return null;
  } finally {
    await page.close();
  }
}

/**
 * 2) scrapeLines: pull earliest & latest Thrillzz lines
 */
async function scrapeLines(matchupId, awayCode, homeCode, browser) {
  const slug = `${awayCode.toLowerCase()}-at-${homeCode.toLowerCase()}`;
  const url  = `https://www.covers.com/sport/baseball/mlb/linemovement/${slug}/${matchupId}`;
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil:'domcontentloaded', timeout:30_000 });
    const rows = await page.$$(LINE_ROW_SEL);
    if (!rows.length) return null;

    const data = [];
    for (let row of rows) {
      const txt = await row.$eval('td:first-child div', el => el.textContent);
      const ts  = new Date(txt.replace(/\(ET\)/,'') + ' ET');
      const [aL,hL] = await Promise.all([
        row.$eval(`td:nth-child(2) ${AM_SEL}`, el=>parseInt(el.textContent.trim(),10)),
        row.$eval(`td:nth-child(3) ${AM_SEL}`, el=>parseInt(el.textContent.trim(),10))
      ]);
      data.push({ ts, aL, hL });
    }

    // Thrillzz: newest-first, so last=earliest, first=latest
    const first = data[data.length-1], last = data[0];
    return {
      away: { time_min:first.ts,  line_min:first.aL,  time_max:last.ts, line_max:last.aL },
      home: { time_min:first.ts,  line_min:first.hL,  time_max:last.ts, line_max:last.hL }
    };
  } finally {
    await page.close();
  }
}

/**
 * 3) main: fetch bets, scrape, upsert CLV
 */
async function fetchAllCLV() {
  if (!(await testConnection())) throw new Error('DB connection failed');

  const today = new Date().toISOString().slice(0,10);
  const { data: bets, error } = await supabase
    .from('mlb_daily_bets')
    .select('*')
    .eq('game_date', today);

  if (error) throw error;
  if (!bets.length) {
    console.log('▶︎ No bets for', today);
    return;
  }

  const browser = await puppeteer.launch({
    channel: 'chrome', headless: 'new', args:['--no-sandbox']
  });

  // group bets by matchup
  const byMatch = bets.reduce((m,b)=>{ (m[b.matchup_id]||(m[b.matchup_id]=[])).push(b); return m }, {});

  for (let mId of Object.keys(byMatch)) {
    // 3a) scrape box for codes
    const box = await scrapeBox(mId, browser);
    if (!box) continue;
    const awayCode = NAME_TO_ABBR[box.away_abbr] || box.away_abbr;
    const homeCode = NAME_TO_ABBR[box.home_abbr] || box.home_abbr;

    // 3b) scrape line movement
    const lines = await scrapeLines(mId, awayCode, homeCode, browser);
    if (!lines) continue;

    // 3c) upsert each bet in this matchup
    for (let b of byMatch[mId]) {
      // determine side
      const raw = b.team_name.toUpperCase().replace(/\./g,'').trim();
      const abbr= NAME_TO_ABBR[raw]||raw;
      const side= abbr===awayCode ? 'away' : abbr===homeCode ? 'home' : null;
      if (!side) {
        console.warn(`⚠️ Unknown side for ${b.team_name} in ${mId}`);
        continue;
      }

      const rec = {
        matchup_id:    mId,
        team_id:       b.team_id,
        game_date:     b.game_date,
        source:        'Thrillzz',
        line_time_min: lines[side].time_min,
        line_min:      lines[side].line_min,
        line_time_max: lines[side].time_max,
        line_max:      lines[side].line_max
      };

      const { error: upErr } = await supabase
        .from('mlb_line_movements')
        .upsert(rec, { onConflict: 'matchup_id,team_id,source' });

      if (upErr) console.error('❌ upsert failed', upErr);
    }
  }

  await browser.close();
}

if (import.meta.url.endsWith('fetchLineMovement.js')) {
  console.log('▶︎ Fetching closing lines');
  fetchAllCLV()
    .then(()=>{ console.log('✅ Done'); process.exit(0) })
    .catch(e=>{ console.error(e); process.exit(1) });
}
