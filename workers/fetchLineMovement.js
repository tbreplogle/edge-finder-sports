// workers/fetchLineMovement.js
import puppeteer from 'puppeteer';
import { supabase, testConnection } from './lib/supabaseClient.js';

/* ──────────────────────────────────────────────────────────────
   TEAM MAPS
   ────────────────────────────────────────────────────────────── */
const NAME_TO_ABBR = {
  'ARIZONA DIAMONDBACKS':'ARI','ARIZONA':'ARI','DIAMONDBACKS':'ARI',
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
  // extras / oddities
  CH:'CHC',CU:'CHC',CUBS:'CHC',WHT:'CWS',CHW:'CWS',STL:'STL',
  AZ:'ARI',ARZ:'ARI',BO:'BOS',KC:'KCR',TB:'TBR',SD:'SDP',
  SF:'SFG',NYK:'NYY',WAS:'WSH',ATH:'OAK','ST LOUIS':'STL','SAINT LOUIS':'STL',
  OAK:'OAK',BOS:'BOS',NYY:'NYY'
};
'ARI ATL BAL BOS CHC CIN CLE COL CWS DET HOU KCR LAA LAD MIA MIL MIN NYM NYY OAK PHI PIT SDP SFG SEA STL TBR TEX TOR WSH'
  .split(/\s+/).forEach(c => NAME_TO_ABBR[c] = c);

// Slug candidates for Covers; we’ll try these in order (both away-at-home and home-at-away)
const ABBR_TO_SLUGS = {
  ARI:['ari','arz'], ATL:['atl'],
  BAL:['bal'], BOS:['bos'],
  CHC:['chc','cu','cubs','chi-cubs'],
  CWS:['chw','cws','wht','chi-white-sox'],
  CIN:['cin'], CLE:['cle'], COL:['col'], DET:['det'], HOU:['hou'],
  KCR:['kc','kcr'],
  LAA:['laa','ana','angels','la-angels'],
  LAD:['lad','la','dodgers','la-dodgers'],
  MIA:['mia'], MIL:['mil'], MIN:['min'],
  NYM:['nym','ny-mets','mets'],
  NYY:['nyy','ny-yankees','yanks'],
  OAK:['oak','athletics'],
  PHI:['phi','phillies'],
  PIT:['pit'],
  SDP:['sd','sdp','sdg','padres'],
  SFG:['sf','sfo','sfg','giants'],
  SEA:['sea'],
  STL:['stl'],
  TBR:['tb','tbr','rays'],
  TEX:['tex','rangers'],
  TOR:['tor','blue-jays','jays'],
  WSH:['wsh','was','nationals']
};

/* ──────────────────────────────────────────────────────────────
   SELECTORS / UTILITIES
   ────────────────────────────────────────────────────────────── */
const LINE_TABLE_SEL = '.covers-CoversOdds-lineMovementTable';
const LINE_ROW_SEL   = '.covers-CoversOdds-lineMovementTable tbody tr';
const AM_SEL         = 'div.American';

// EDT ≈ UTC-4 during MLB; good enough for storage/ordering
const MONTH = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
function toUTCFromET(year, monIdx, day, hh, mm) {
  return new Date(Date.UTC(year, monIdx, day, hh + 4, mm, 0, 0));
}
function parseETTimestamp(txt, fallbackYear) {
  const s = (txt || '').replace(/\s+/g, ' ').replace('(ET)', '').trim();
  const m = s.match(/([A-Za-z]{3})\s+(\d{1,2}).*?(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const mon = MONTH[m[1]], day = +m[2], hh = +m[3], mm = +m[4];
  if ([mon, day, hh, mm].some(Number.isNaN)) return null;
  return toUTCFromET(fallbackYear, mon, day, hh, mm);
}

/* Get away/home abbrs from boxscore page (reliable for past games). */
async function getAwayHomeAbbr(matchupId, browser) {
  const url = `https://www.covers.com/sport/baseball/mlb/boxscore/${matchupId}`;
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil:'domcontentloaded', timeout:45000 });
    const names = await page.$$eval(
      '.covers-CoversMatchupDetails-awayName, .covers-CoversMatchupDetails-homeName',
      els => els.map(e => (e.textContent || '').trim().toUpperCase())
    );
    if (names.length !== 2) return null;
    return {
      away: NAME_TO_ABBR[names[0]] || names[0],
      home: NAME_TO_ABBR[names[1]] || names[1]
    };
  } catch (_) {
    return null;
  } finally {
    await page.close();
  }
}

/* Prefer discovering the exact linemovement URL off the boxscore page. */
async function getLineMovementUrlFromBox(matchupId, browser) {
  const url = `https://www.covers.com/sport/baseball/mlb/boxscore/${matchupId}`;
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil:'domcontentloaded', timeout:45000 });
    const href = await page.$$eval('a', as => {
      const r = new RegExp('/sport/baseball/mlb/linemovement/.+?/\\d+$');
      const hit = as.find(a => a.href && r.test(a.href));
      return hit ? hit.href : null;
    });
    return href || null;
  } catch (_) {
    return null;
  } finally {
    await page.close();
  }
}

/* If boxscore doesn’t expose the link, try slug candidates in both orders. */
async function findLineMovementPageBySlug(browser, matchupId, awayAbbr, homeAbbr) {
  const page = await browser.newPage();
  const awaySlugs = ABBR_TO_SLUGS[awayAbbr] || [awayAbbr.toLowerCase()];
  const homeSlugs = ABBR_TO_SLUGS[homeAbbr] || [homeAbbr.toLowerCase()];

  const candidates = [];
  for (const a of awaySlugs) for (const h of homeSlugs) {
    candidates.push(`https://www.covers.com/sport/baseball/mlb/linemovement/${a}-at-${h}/${matchupId}`);
  }
  for (const h of homeSlugs) for (const a of awaySlugs) {
    candidates.push(`https://www.covers.com/sport/baseball/mlb/linemovement/${h}-at-${a}/${matchupId}`);
  }
  // id-only fallbacks
  candidates.push(`https://www.covers.com/sport/baseball/mlb/linemovement/${matchupId}`);
  candidates.push(`https://www.covers.com/sport/baseball/mlb/linemovement/x-at-y/${matchupId}`);

  for (const url of candidates) {
    try {
      await page.goto(url, { waitUntil:'domcontentloaded', timeout:20000 });
      const hasTable = await page.$(LINE_TABLE_SEL);
      if (hasTable) return { page, url };
    } catch (_) { /* next */ }
  }
  await page.close();
  return null;
}

/* Scrape earliest (open) and latest (close) American odds from Thrillzz table. */
async function scrapeLinesFromOpenPage(page, gameYear) {
  const rows = await page.$$(LINE_ROW_SEL);
  if (!rows.length) return null;

  const data = [];
  for (let row of rows) {
    const tsText = await row.$eval('td:first-child', el => (el.innerText || el.textContent || '').trim());
    const ts = parseETTimestamp(tsText, gameYear);
    const [awayLine, homeLine] = await Promise.all([
      row.$eval(`td:nth-child(2) ${AM_SEL}`, el => parseInt(el.textContent.trim(), 10)).catch(()=>null),
      row.$eval(`td:nth-child(3) ${AM_SEL}`, el => parseInt(el.textContent.trim(), 10)).catch(()=>null),
    ]);
    if (ts && Number.isInteger(awayLine) && Number.isInteger(homeLine)) {
      data.push({ ts, awayLine, homeLine });
    }
  }
  if (!data.length) return null;

  // newest-first → earliest = last, latest = first
  const earliest = data[data.length - 1];
  const latest   = data[0];
  return {
    earliest_ts: earliest.ts,
    latest_ts:   latest.ts,
    away_min:    earliest.awayLine,
    away_max:    latest.awayLine,
    home_min:    earliest.homeLine,
    home_max:    latest.homeLine
  };
}

async function fetchAllCLV() {
  if (!(await testConnection())) throw new Error('DB connection failed');

  const today = new Date().toISOString().slice(0,10);
  const year  = new Date().getFullYear();

  // 1) Pull all bets BEFORE today and skip any already stored in mlb_line_movements
  const [{ data: allBets, error: betErr }, { data: existing, error: existErr }] = await Promise.all([
    supabase.from('mlb_daily_bets')
      .select('matchup_id, team_id, team_name, game_date')
      .lt('game_date', today),
    supabase.from('mlb_line_movements')
      .select('matchup_id, team_id')
      .lt('game_date', today)
  ]);
  if (betErr) throw betErr;
  if (existErr) throw existErr;

  const haveSet = new Set((existing || []).map(r => `${r.matchup_id}::${r.team_id}`));
  const bets = (allBets || []).filter(b => !haveSet.has(`${b.matchup_id}::${b.team_id}`));

  if (!bets.length) {
    console.log('▶︎ Nothing to backfill (all past bets already have CLV rows).');
    return;
  }

  const browser = await puppeteer.launch({ channel:'chrome', headless:'new', args:['--no-sandbox'] });

  // 2) Group by matchup_id so we scrape each page once
  const byMatch = bets.reduce((m, b) => {
    (m[b.matchup_id] ||= []).push(b);
    return m;
  }, {});

  for (const matchupId of Object.keys(byMatch)) {
    // Resolve away/home abbrs from boxscore (reliable post-game)
    const abbrs = await getAwayHomeAbbr(matchupId, browser);
    if (!abbrs) {
      console.warn(`⚠️ Could not get away/home abbr for matchup ${matchupId}`);
      continue;
    }

    // Prefer link from boxscore; else try slug candidates
    let pageHandle = null;
    const lmUrl = await getLineMovementUrlFromBox(matchupId, browser);
    if (lmUrl) {
      const page = await browser.newPage();
      try {
        await page.goto(lmUrl, { waitUntil:'domcontentloaded', timeout:30000 });
        const hasTable = await page.$(LINE_TABLE_SEL);
        if (hasTable) pageHandle = { page, url: lmUrl };
        else await page.close();
      } catch (_) { try { await page.close(); } catch {} }
    }
    if (!pageHandle) {
      pageHandle = await findLineMovementPageBySlug(browser, matchupId, abbrs.away, abbrs.home);
    }
    if (!pageHandle) {
      console.warn(`⚠️ Could not locate linemovement page for ${matchupId}`);
      continue;
    }

    const { page, url } = pageHandle;
    const scraped = await scrapeLinesFromOpenPage(page, year).catch(()=>null);
    await page.close();

    if (!scraped) {
      console.warn(`⚠️ No Thrillzz rows parsed for ${matchupId} (url: ${url})`);
      continue;
    }

    // 3) Upsert a row per bet (map bet to away/home side)
    for (const b of byMatch[matchupId]) {
      const raw  = (b.team_name || '').toUpperCase().replace(/\./g,'').replace(/\s+/g,' ').trim();
      const abbr = NAME_TO_ABBR[raw] || raw;

      let isAway = abbr === abbrs.away;
      let isHome = abbr === abbrs.home;

      // If team_name didn’t normalize perfectly, still store both sides once per matchup
      if (!isAway && !isHome) {
        console.warn(`⚠️ Unknown side for team "${b.team_name}" (abbr=${abbr}) in matchup ${matchupId}; skipping this bet.`);
        continue;
      }

      const rec = {
        matchup_id:     b.matchup_id,
        team_id:        b.team_id,
        game_date:      b.game_date,
        source:         'Thrillzz',
        line_time_min:  scraped.earliest_ts.toISOString(),
        line_min:       isAway ? scraped.away_min : scraped.home_min,
        line_time_max:  scraped.latest_ts.toISOString(),
        line_max:       isAway ? scraped.away_max : scraped.home_max
      };

      if (!rec.line_time_min || rec.line_min == null || !rec.line_time_max || rec.line_max == null) {
        console.warn(`⚠️ Skipping upsert (incomplete data) team_id=${b.team_id}, matchup=${b.matchup_id}`);
        continue;
      }

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
