// workers/scrapeMatchupIds.js
import puppeteer from 'puppeteer';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

const DEBUG = process.env.DEBUG === 'true';

/**
 * Hard-coded map from Covers.com team labels → your teams_mlb.team_id
 */
const TEAM_NAME_TO_ID = {
  // home-teams
  'WASHINGTON':    24,
  'ATLANTA':       17,
  'TAMPA BAY':     9,
  'BOSTON':        29,
  'COLORADO':      22,
  'MILWAUKEE':     14,
  'KANSAS CITY':   11,
  'MINNESOTA':     10,
  'ST. LOUIS':     27,
  'CHI. CUBS':     16,
  'NY YANKEES':    8,
  'MIAMI':         6,
  'ATHLETICS':     7,
  'LA ANGELS':     4,
  'ARIZONA':       13,

  // away-teams
  'CLEVELAND':     2,
  'CINCINNATI':    23,
  'PHILADELPHIA':  26,
  'TEXAS':         28,
  'DETROIT':       25,
  'HOUSTON':       19,
  'CHI. WHITE SOX':15,
  'BALTIMORE':     30,
  'PITTSBURGH':    3,
  'SAN FRANCISCO': 12,
  'SAN DIEGO':     18,
  'LA DODGERS':    21,
  'SEATTLE':       1,
  'TORONTO':       5,
  'NY METS':       20
};

async function scrapeTodayMatchups() {
  console.log('→ Launching browser and navigating to Covers.com MLB matchups…');
  const browser = await puppeteer.launch({
    headless: 'new',
    channel: 'chrome',               // use system Chrome
    args: ['--no-sandbox','--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width:1920, height:1080 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'
  );

  // today's date param
  const today = new Date().toISOString().slice(0,10);
  const url = `https://www.covers.com/sports/mlb/matchups?selectedDate=${today}`;
  console.log(`→ Opening ${url}`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  // wait for the matchup links
  await page.waitForSelector('a.matchup-btn-link', { timeout: 30000 });
  await page.waitForTimeout(1000);

  const matchups = await page.$$eval('article.gamebox', games =>
    games.map(game => {
      const link = game.querySelector('a.matchup-btn-link');
      if (!link) return null;

      // extract numeric ID
      const m = link.href.match(/\/matchup\/(\d+)$/);
      if (!m) return null;
      const matchup_id = m[1];
      const game_id    = matchup_id;

      // split "AWAY @ HOME"
      const teamsText = game.querySelector('strong.text-uppercase')
                         ?.innerText.trim().toUpperCase();
      if (!teamsText || !teamsText.includes('@')) return null;
      const [away_team, home_team] = teamsText
        .split('@')
        .map(t => t.replace(/\u202F/g,' ').trim());

      // parse displayed date string
      const dateText = game.querySelector('strong.preGame-status')
                        ?.innerText.trim();
      const dt = dateText
        ? new Date(`${dateText} ${new Date().getFullYear()}`)
        : null;
      const game_date = dt ? dt.toISOString().slice(0,10) : null;

      return { game_id, matchup_id, away_team, home_team, game_date };
    })
    .filter(x => x !== null)
  );

  await browser.close();
  console.log(`→ Scraped ${matchups.length} games.`);
  if (DEBUG) console.log(JSON.stringify(matchups, null, 2));
  return matchups;
}

export async function scrapeAndSaveTodayMatchups() {
  console.log('Starting MLB matchup scraper…');
  if (!(await testConnection())) {
    console.error('❌ Supabase connection failed, aborting.');
    process.exit(1);
  }

  try {
    const matchups = await scrapeTodayMatchups();

    if (matchups.length === 0) {
      console.warn('⚠️  No matchups found today — nothing to insert.');
      await createScrapeReport({
        success: false,
        error: 'No matchups found',
        timestamp: new Date().toISOString(),
        stats: { matchups: 0 }
      });
      return { success: false, error: 'No matchups found', matchups: [] };
    }

    // enrich with FK IDs
    const enriched = matchups.map(m => ({
      ...m,
      away_team_id: TEAM_NAME_TO_ID[m.away_team] ?? null,
      home_team_id: TEAM_NAME_TO_ID[m.home_team] ?? null
    }));

    console.log(`→ Upserting ${enriched.length} records to Supabase…`);
    const { data, error } = await supabase
      .from('mlb_matchups')
      .upsert(enriched, { onConflict: ['matchup_id'] })
      .select();

    if (error) throw error;

    console.log(`✅ Saved ${data.length} rows.`);
    await createScrapeReport({
      success: true,
      timestamp: new Date().toISOString(),
      stats: { matchups: data.length },
      matchups: data
    });
    return { success: true, matchups: data };

  } catch (err) {
    console.error('❌ Error in scraper:', err.message);
    await createScrapeReport({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
      stats: { matchups: 0 }
    });
    return { success: false, error: err.message, matchups: [] };
  }
}

// if run directly
if (import.meta.url.endsWith('scrapeMatchupIds.js')) {
  scrapeAndSaveTodayMatchups()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
