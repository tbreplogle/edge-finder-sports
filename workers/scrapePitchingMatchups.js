// workers/scrapePitchingMatchups.js
import puppeteer from 'puppeteer';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

const DEBUG = process.env.DEBUG === 'true';

// map of Covers.com alt_name → your teams_mlb.team_id
const TEAM_ALT_NAME_TO_ID = {
  'SEATTLE':          1,
  'CLEVELAND':        2,
  'PITTSBURGH':       3,
  'LA ANGELS':        4,
  'TORONTO':          5,
  'MIAMI':            6,
  'ATHLETICS':        7,
  'NY YANKEES':       8,
  'TAMPA BAY':        9,
  'MINNESOTA':       10,
  'KANSAS CITY':     11,
  'SF GIANTS':       12,
  'ARIZONA':         13,
  'MILWAUKEE':       14,
  'CHI. WHITE SOX':  15,
  'CHI. CUBS':       16,
  'ATLANTA':         17,
  'SAN DIEGO':       18,
  'HOUSTON':         19,
  'NY METS':         20,
  'LA DODGERS':      21,
  'COLORADO':        22,
  'CINCINNATI':      23,
  'WASHINGTON':      24,
  'DETROIT':         25,
  'PHILADELPHIA':    26,
  'ST. LOUIS':       27,
  'TEXAS':           28,
  'BOSTON':          29,
  'BALTIMORE':       30
};

async function scrapePitchingMatchups() {
  // 1) get today’s games
  const today = new Date().toISOString().slice(0,10);
  const { data: games, error: fetchErr } = await supabase
    .from('mlb_matchups')
    .select('matchup_id')
    .eq('game_date', today);

  if (fetchErr) {
    console.error('❌ Could not load today’s matchups:', fetchErr);
    throw fetchErr;
  }
  if (!games.length) {
    console.log('⚠️  No matchups for today.');
    return [];
  }
  console.log(`→ Found ${games.length} games to scrape.`);

  // 2) launch Puppeteer
  const browser = await puppeteer.launch({
    args: ['--no-sandbox','--disable-setuid-sandbox'],
    headless: 'new'
  });
  const page = await browser.newPage();
  await page.setViewport({ width:1920, height:1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  const rows = [];

  for (const { matchup_id } of games) {
    const url = `https://www.covers.com/sport/baseball/mlb/matchup/${matchup_id}`;
    console.log(`→ Loading ${url}`);
    await page.goto(url, { waitUntil:'networkidle2', timeout:60000 });
    // wait for the Away tab link to appear
    await page.waitForSelector('a[href="#away-team-last-5"]', { timeout:30000 });

    // helper to pull “Last 5 Avg.” row values from a given tab prefix
    const extractLast5 = async prefix => {
      const pitcherName = await page.$eval(
        `#${prefix}-team-last-5 a.anchor-with-border`,
        el => el.innerText.trim()
      );
      const raw = await page.$$eval(
        `#${prefix}-team-last-5 table tr`,
        trs => {
          const tr = trs.find(r =>
            r.querySelector('td b')?.innerText.trim() === 'Last 5 Avg.'
          );
          if (!tr) return [];
          // grab every <b> cell except the first “Last 5 Avg.”
          return Array.from(tr.querySelectorAll('td b'))
                      .map(b => b.innerText.trim())
                      .slice(1);
        }
      );
      return { pitcherName, raw };
    };

    // --- AWAY ---
    const awayTab = await extractLast5('away');
    if (awayTab.raw.length === 10) {
      const [ip,h,r,er,so,bb,hr,pit,pip,gbfb] = awayTab.raw;
      rows.push({
        matchup_id,
        pitcher_role:   'away',
        team_name:      (await page.$eval(
                           'a[href="#away-team-last-5"]',
                           el => el.innerText.trim().toUpperCase()
                         )),
        team_id:        TEAM_ALT_NAME_TO_ID[
                           (await page.$eval(
                             'a[href="#away-team-last-5"]',
                             el => el.innerText.trim().toUpperCase()
                           ))
                         ] ?? null,
        pitcher_name:   awayTab.pitcherName,
        ip, h, r, er, so, bb, hr, pit, pip, gbfb
      });
    } else {
      console.warn(`⚠️ Away stats missing for ${matchup_id}`);
    }

    // --- HOME ---
    const homeTab = await extractLast5('home');
    if (homeTab.raw.length === 10) {
      const [ip,h,r,er,so,bb,hr,pit,pip,gbfb] = homeTab.raw;
      rows.push({
        matchup_id,
        pitcher_role:   'home',
        team_name:      (await page.$eval(
                           'a[href="#home-team-last-5"]',
                           el => el.innerText.trim().toUpperCase()
                         )),
        team_id:        TEAM_ALT_NAME_TO_ID[
                           (await page.$eval(
                             'a[href="#home-team-last-5"]',
                             el => el.innerText.trim().toUpperCase()
                           ))
                         ] ?? null,
        pitcher_name:   homeTab.pitcherName,
        ip, h, r, er, so, bb, hr, pit, pip, gbfb
      });
    } else {
      console.warn(`⚠️ Home stats missing for ${matchup_id}`);
    }
  }

  await browser.close();
  console.log(`→ Scraped ${rows.length} pitcher‑records`);
  if (DEBUG) console.log(JSON.stringify(rows, null,2));
  return rows;
}

export async function scrapeAndSavePitchingMatchups() {
  console.log('⏳ Starting pitching‑matchups scraper…');
  if (!(await testConnection())) {
    console.error('❌ Supabase connection failed, aborting.');
    process.exit(1);
  }

  try {
    const stats = await scrapePitchingMatchups();
    if (!stats.length) {
      console.warn('⚠️ No pitching stats to insert');
      createScrapeReport({
        success:   false,
        error:     'No pitching stats found',
        timestamp: new Date().toISOString(),
        stats:     { records: 0 }
      });
      return;
    }

    // 3) cast & compute
    const enriched = stats.map(r => {
      const ipVal  = parseFloat(r.ip)   || 0;
      const hVal   = parseFloat(r.h)    || 0;
      const rVal   = parseFloat(r.r)    || 0;
      const erVal  = parseFloat(r.er)   || 0;
      const soVal  = parseFloat(r.so)   || 0;
      const bbVal  = parseFloat(r.bb)   || 0;
      const hrVal  = parseFloat(r.hr)   || 0;
      const pitVal = parseFloat(r.pit)  || 0;
      const pipVal = parseFloat(r.pip)  || null;
      const gbfbVal= parseFloat(r.gbfb) || null;

      const eraVal     = ipVal>0 ? +( (erVal / ipVal) * 9 ).toFixed(2) : null;
      const eraPlusVal = eraVal  ? +((100 * (4.1 / eraVal))).toFixed(0) : null;
      const whipVal    = ipVal>0 ? +(((bbVal + hVal) / ipVal)).toFixed(3) : null;

      return {
        matchup_id:   r.matchup_id,
        pitcher_role: r.pitcher_role,
        team_name:    r.team_name,
        team_id:      r.team_id,
        pitcher_name: r.pitcher_name,

        // now real JS numbers, no strings
        ip:      +ipVal.toFixed(1),
        h:       Math.round(hVal),
        r:       Math.round(rVal),
        er:      Math.round(erVal),
        so:      Math.round(soVal),
        bb:      Math.round(bbVal),
        hr:      Math.round(hrVal),
        pit:     Math.round(pitVal),
        pip:     pipVal,
        gbfb:    gbfbVal,

        era:      eraVal,
        era_plus: eraPlusVal,
        whip:     whipVal
      };
    });

    console.log(`→ Upserting ${enriched.length} records to Supabase…`);
    const { data, error } = await supabase
      .from('pitching_matchups')
      .upsert(enriched, { onConflict: ['matchup_id','pitcher_role'] })
      .select();

    if (error) throw error;
    console.log(`✅ Saved ${data.length} pitching records`);
    createScrapeReport({
      success:   true,
      timestamp: new Date().toISOString(),
      stats:     { records: data.length },
      records:   data
    });
  }
  catch (err) {
    console.error('❌ Error inserting pitching stats:', err);
    createScrapeReport({
      success: false,
      error:   err.message,
      timestamp: new Date().toISOString(),
      stats: { records: 0 }
    });
  }
}

// auto‑run when invoked directly
if (import.meta.url.endsWith('scrapePitchingMatchups.js')) {
  scrapeAndSavePitchingMatchups()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
