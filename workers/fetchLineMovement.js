// workers/fetchLineMovement.js
import puppeteer from 'puppeteer';
import { supabase, testConnection } from './lib/supabaseClient.js';

/* ─── full team-name ⇒ 3-letter map (inlined) ─── */
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
  /* extras / oddities */
  CH:'CHC',CU:'CHC',CUBS:'CHC',WHT:'CWS',CHW:'CWS',STL:'STL',
  AZ:'ARI',ARZ:'ARI',BO:'BOS',KC:'KCR',TB:'TBR',SD:'SDP',
  SF:'SFG',NYK:'NYY',WAS:'WSH',ATH:'OAK','ST LOUIS':'STL','SAINT LOUIS':'STL',
  OAK:'OAK',BOS:'BOS',NYY:'NYY'
};
'ARI ATL BAL BOS CHC CIN CLE COL CWS DET HOU KCR LAA LAD MIA MIL MIN NYM NYY OAK PHI PIT SDP SFG SEA STL TBR TEX TOR WSH'
  .split(/\s+/).forEach(c => NAME_TO_ABBR[c] = c);

/* ─── selectors ─── */
const LINE_ROW_SEL = '.covers-CoversOdds-lineMovementTable tbody tr';
const AM_SEL       = 'div.American';

/* DST-naive but correct for MLB season (EDT = UTC-4) */
function toUTCFromET(year, monthIdx, day, hh, mm) {
  // EDT offset = -4 hours → UTC = local + 4
  return new Date(Date.UTC(year, monthIdx, day, hh + 4, mm, 0, 0));
}
const MONTH = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };

/* Parse "Tue, Aug 5\n18:04 ET (ET)" → Date (UTC) */
function parseETTimestamp(text, fallbackYear) {
  const s = text.replace(/\s+/g, ' ').replace('(ET)', '').trim(); // "Tue, Aug 5 18:04 ET"
  // grab "Aug 5" + "18:04"
  const m = s.match(/([A-Za-z]{3})\s+(\d{1,2}).*?(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const mon = MONTH[m[1]];
  const day = parseInt(m[2], 10);
  const hh  = parseInt(m[3], 10);
  const mm  = parseInt(m[4], 10);
  if (Number.isNaN(mon) || Number.isNaN(day) || Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return toUTCFromET(fallbackYear, mon, day, hh, mm);
}

/* Grab the canonical Line Movement URL from the boxscore page (no slug guessing). */
async function getLineMovementUrl(matchupId, browser) {
  const url = `https://www.covers.com/sport/baseball/mlb/boxscore/${matchupId}`;
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // look for an <a> that points to /linemovement/.../<matchupId>
    const href = await page.$$eval('a', as => {
      const r = new RegExp('/sport/baseball/mlb/linemovement/.+?/\\d+$');
      const hit = as.find(a => a.href && r.test(a.href));
      return hit ? hit.href : null;
    });
    return href || null;
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

/* Scrape earliest & latest Thrillzz lines from the line-movement page */
async function scrapeLinesFromUrl(lineUrl, gameYear, browser) {
  const page = await browser.newPage();
  try {
    await page.goto(lineUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const rows = await page.$$(LINE_ROW_SEL);
    if (!rows.length) return null;

    const data = [];
    for (let row of rows) {
      const tsText = await row.$eval('td:first-child', el => (el.innerText || el.textContent || '').trim());
      const ts     = parseETTimestamp(tsText, gameYear); // → Date or null
      const [awayLine, homeLine] = await Promise.all([
        row.$eval(`td:nth-child(2) ${AM_SEL}`, el => parseInt(el.textContent.trim(), 10)).catch(() => null),
        row.$eval(`td:nth-child(3) ${AM_SEL}`, el => parseInt(el.textContent.trim(), 10)).catch(() => null)
      ]);
      if (ts && Number.isInteger(awayLine) && Number.isInteger(homeLine)) {
        data.push({ ts, awayLine, homeLine });
      }
    }
    if (!data.length) return null;

    // Table is newest-first → last = earliest, first = latest
    const earliest = data[data.length - 1];
    const latest   = data[0];
    return {
      earliest_ts: earliest.ts,
      latest_ts:   latest.ts,
      away: { line_min: earliest.awayLine, line_max: latest.awayLine },
      home: { line_min: earliest.homeLine, line_max: latest.homeLine }
    };
  } finally {
    await page.close();
  }
}

async function fetchAllCLV() {
  if (!(await testConnection())) throw new Error('DB connection failed');

  const today = new Date().toISOString().slice(0,10);
  const year  = new Date().getFullYear();

  // You can widen this filter (e.g., >= today) if you want next-day lines too
  const { data: bets, error } = await supabase
    .from('mlb_daily_bets')
    .select('matchup_id, team_id, team_name, game_date')
    .eq('game_date', today);

  if (error) throw error;
  if (!bets?.length) {
    console.log('▶︎ No bets for', today);
    return;
  }

  const browser = await puppeteer.launch({ channel: 'chrome', headless: 'new', args: ['--no-sandbox'] });

  // Group by matchup_id to scrape each page once
  const byMatch = bets.reduce((m, b) => {
    (m[b.matchup_id] = m[b.matchup_id] || []).push(b);
    return m;
  }, {});

  for (const matchupId of Object.keys(byMatch)) {
    const lmUrl = await getLineMovementUrl(matchupId, browser);
    if (!lmUrl) {
      console.warn(`⚠️ Could not locate linemovement URL for ${matchupId}`);
      continue;
    }

    const lines = await scrapeLinesFromUrl(lmUrl, year, browser);
    if (!lines) {
      console.warn(`⚠️ No Thrillzz rows parsed for ${matchupId}`);
      continue;
    }

    // Upsert one row per bet (team). Determine side from team_name vs. headings on line page? We can’t
    // read headings reliably here, so infer from the boxscore page team names like grader does.
    // Simpler: check which side they bet by comparing abbreviation to the two names on the line page path.
    // The path includes ".../<away>-at-<home>/<id>", so fetch abbreviations from the boxscore as well:
    const boxPage = await browser.newPage();
    let awayAbbr = null, homeAbbr = null;
    try {
      await boxPage.goto(`https://www.covers.com/sport/baseball/mlb/boxscore/${matchupId}`, { waitUntil:'domcontentloaded', timeout: 45000 });
      const names = await boxPage.$$eval(
        '.covers-CoversMatchupDetails-awayName, .covers-CoversMatchupDetails-homeName',
        els => els.map(e => e.textContent.trim().toUpperCase())
      );
      if (names.length === 2) {
        awayAbbr = NAME_TO_ABBR[names[0]] || names[0];
        homeAbbr = NAME_TO_ABBR[names[1]] || names[1];
      }
    } catch (_) {} finally { await boxPage.close(); }

    for (const b of byMatch[matchupId]) {
      const raw  = b.team_name.toUpperCase().replace(/\./g,'').replace(/\s+/g,' ').trim();
      const abbr = NAME_TO_ABBR[raw] || raw;

      let side = null;
      if (abbr === awayAbbr) side = 'away';
      else if (abbr === homeAbbr) side = 'home';
      else {
        console.warn(`⚠️ Unknown side for ${b.team_name} (abbr=${abbr}) in matchup ${matchupId}`);
        continue;
      }

      const rec = {
        matchup_id:     matchupId,
        team_id:        b.team_id,
        game_date:      b.game_date,
        source:         'Thrillzz',
        line_time_min:  lines.earliest_ts.toISOString(),
        line_min:       lines[side].line_min,
        line_time_max:  lines.latest_ts.toISOString(),
        line_max:       lines[side].line_max
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
    .then(() => { console.log('✅ Done'); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });
}
