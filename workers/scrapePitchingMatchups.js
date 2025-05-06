// workers/scrapePitchingMatchups.js
import puppeteer from 'puppeteer';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

const DEBUG = process.env.DEBUG === 'true';

// map the exact alt_name values → your team_id
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
  // 1) pull today's matchup_ids
  const today = new Date().toISOString().slice(0,10);
  const { data: games, error: fetchErr } = await supabase
    .from('mlb_matchups')
    .select('matchup_id')
    .eq('game_date', today);

  if (fetchErr) {
    console.error('❌ Could not load today’s matchups:', fetchErr);
    throw fetchErr;
  }
  if (games.length === 0) {
    console.log('⚠️  No matchups for today.');
    return [];
  }
  console.log(`→ Found ${games.length} games to scrape.`);

  // 2) spin up Puppeteer
  const browser = await puppeteer.launch({
    args: ['--no-sandbox','--disable-setuid-sandbox'],
    headless: 'new'
  });
  const page = await browser.newPage();
  await page.setViewport({ width:1920, height:1080 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  );

  const rows = [];

  for (const { matchup_id } of games) {
    const url = `https://www.covers.com/sport/baseball/mlb/matchup/${matchup_id}`;
    console.log(`→ Loading ${url}`);
    await page.goto(url, { waitUntil:'networkidle2', timeout:60000 });
    await page.waitForSelector('a[href="#away-team-last-5"]', { timeout:30000 });

    // --- AWAY side ---
    const awayName = await page.$eval(
      'a[href="#away-team-last-5"]',
      el => el.innerText.trim().toUpperCase()
    );
    const away_team_id = TEAM_ALT_NAME_TO_ID[awayName] ?? null;
    const away_pitcher = await page.$eval(
      '#away-team-last-5 a.anchor-with-border',
      el => el.innerText.trim()
    );
    const awayVals = await page.$$eval(
      '#away-team-last-5 table tr',
      trs => {
        const tr = trs.find(r => {
          const b = r.querySelector('td b');
          return b && b.innerText.trim() === 'Last 5 Avg.';
        });
        if (!tr) return [];
        const allB = Array.from(tr.querySelectorAll('td b')).map(b=>b.innerText.trim());
        return allB.slice(1);
      }
    );
    if (awayVals.length === 10) {
      const [ip,h,r,er,so,bb,hr,pit,pip,gbfb] = awayVals;
      rows.push({
        matchup_id,
        pitcher_role:   'away',
        team_name:      awayName,
        team_id:        away_team_id,
        pitcher_name:   away_pitcher,
        ip,h,r,er,so,bb,hr,pit,pip,gbfb
      });
    } else {
      console.warn(`⚠️ Away-stats missing for matchup ${matchup_id}`);
    }

    // --- HOME side ---
    const homeName = await page.$eval(
      'a[href="#home-team-last-5"]',
      el => el.innerText.trim().toUpperCase()
    );
    const home_team_id = TEAM_ALT_NAME_TO_ID[homeName] ?? null;
    const home_pitcher = await page.$eval(
      '#home-team-last-5 a.anchor-with-border',
      el => el.innerText.trim()
    );
    const homeVals = await page.$$eval(
      '#home-team-last-5 table tr',
      trs => {
        const tr = trs.find(r => {
          const b = r.querySelector('td b');
          return b && b.innerText.trim() === 'Last 5 Avg.';
        });
        if (!tr) return [];
        const allB = Array.from(tr.querySelectorAll('td b')).map(b=>b.innerText.trim());
        return allB.slice(1);
      }
    );
    if (homeVals.length === 10) {
      const [ip,h,r,er,so,bb,hr,pit,pip,gbfb] = homeVals;
      rows.push({
        matchup_id,
        pitcher_role:   'home',
        team_name:      homeName,
        team_id:        home_team_id,
        pitcher_name:   home_pitcher,
        ip,h,r,er,so,bb,hr,pit,pip,gbfb
      });
    } else {
      console.warn(`⚠️ Home-stats missing for matchup ${matchup_id}`);
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
    if (stats.length === 0) {
      console.warn('⚠️ No pitching stats to insert');
      createScrapeReport({
        success: false,
        error:   'No pitching stats found',
        timestamp: new Date().toISOString(),
        stats: { records: 0 }
      });
      return;
    }

    // 4) compute ERA, ERA+ & WHIP
    const enriched = stats.map(row => {
      const ipVal = parseFloat(row.ip)  || 0;
      const erVal = parseFloat(row.er)  || 0;
      const hVal  = parseFloat(row.h)   || 0;
      const bbVal = parseFloat(row.bb)  || 0;

      row.era      = ipVal > 0 ? +((erVal / ipVal) * 9).toFixed(2) : null;
      row.era_plus = row.era   ? +(100 * (4.1 / row.era)).toFixed(0) : null;
      row.whip     = ipVal > 0 ? +(((bbVal + hVal) / ipVal)).toFixed(3) : null;

      return row;
    });

    console.log(`→ Upserting ${enriched.length} records to Supabase…`);
    const { data, error } = await supabase
      .from('pitching_matchups')
      .upsert(enriched, {
        onConflict: ['matchup_id','pitcher_role']
      })
      .select();

    if (error) throw error;
    console.log(`✅ Saved ${data.length} pitching records`);
    createScrapeReport({
      success: true,
      timestamp: new Date().toISOString(),
      stats: { records: data.length },
      records: data
    });
  } catch (err) {
    console.error('❌ Error inserting pitching stats:', err);
    createScrapeReport({
      success: false,
      error:   err.message,
      timestamp: new Date().toISOString(),
      stats: { records: 0 }
    });
  }
}

// if run directly…
if (import.meta.url.endsWith('scrapePitchingMatchups.js')) {
  scrapeAndSavePitchingMatchups()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
