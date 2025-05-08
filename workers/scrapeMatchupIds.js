// workers/scrapePitchingMatchups.js
import puppeteer from 'puppeteer';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

const DEBUG = process.env.DEBUG === 'true';

/**
 * href‑tab text → team_id
 * Matches the “alt_name” in your teams_mlb table
 */
const TEAM_ALT_NAME_TO_ID = {
  SEATTLE:       1,
  CLEVELAND:     2,
  PITTSBURGH:    3,
  'LA ANGELS':   4,
  TORONTO:       5,
  MIAMI:         6,
  ATHLETICS:     7,
  'NY YANKEES':  8,
  'TAMPA BAY':   9,
  MINNESOTA:    10,
  'KANSAS CITY':11,
  'SF GIANTS':  12,
  'SAN FRANCISCO':12,   // covers.com tab shows “San Francisco”
  ARIZONA:      13,
  MILWAUKEE:    14,
  'CHI. WHITE SOX':15,
  'CHI. CUBS':     16,
  ATLANTA:       17,
  'SAN DIEGO':   18,
  HOUSTON:       19,
  'NY METS':     20,
  'LA DODGERS':  21,
  COLORADO:      22,
  CINCINNATI:    23,
  WASHINGTON:    24,
  DETROIT:       25,
  PHILADELPHIA:  26,
  'ST. LOUIS':   27,
  TEXAS:         28,
  BOSTON:        29,
  BALTIMORE:     30
};

async function scrapePitchingMatchups() {
  // 1) pull today’s matchups
  const today = new Date().toISOString().slice(0,10);
  const { data: games, error: fetchErr } = await supabase
    .from('mlb_matchups')
    .select('matchup_id')
    .eq('game_date', today);

  if (fetchErr) throw new Error(`Could not load today's matchups: ${fetchErr.message}`);
  if (!games.length) {
    console.warn('⚠️  No matchups for today');
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
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');

  const rows = [];

  for (let { matchup_id } of games) {
    const url = `https://www.covers.com/sport/baseball/mlb/matchup/${matchup_id}`;
    console.log(`→ Loading ${url}`);
    await page.goto(url, { waitUntil:'networkidle2', timeout:60000 });
    await page.waitForSelector('a[href="#away-team-last-5"]', { timeout:30000 });

    for (let role of ['away','home']) {
      const tab = role==='away' ? '#away-team-last-5' : '#home-team-last-5';

      // — team name from the tab anchor
      let team_name = null, team_id = null;
      try {
        team_name = await page.$eval(
          `a[href="${tab}"]`,
          el => el.innerText.trim().toUpperCase()
        );
        team_id = TEAM_ALT_NAME_TO_ID[team_name] ?? null;
        if (!team_id) console.warn(`⚠️ No team_id mapping for "${team_name}"`);
      } catch {
        console.warn(`⚠️ Could not read team name for ${role} side of ${matchup_id}`);
      }

      // — pitcher name
      let pitcher_name = null;
      try {
        pitcher_name = await page.$eval(
          `${tab} a.anchor-with-border`,
          el => el.innerText.trim()
        );
      } catch {
        console.warn(`⚠️ Could not read ${role} pitcher for matchup ${matchup_id}`);
        continue;
      }

      // — find the <tr> whose first <b> is "Last 5 Avg."
      const trHandles = await page.$$(`${tab} table tr`);
      let statRow = null;
      for (let tr of trHandles) {
        try {
          const txt = await tr.$eval('td b', b => b.innerText.trim().toLowerCase());
          if (txt.includes('last') && txt.includes('avg')) {
            statRow = tr;
            break;
          }
        } catch {
          // no <b> in this row
        }
      }
      if (!statRow) {
        console.warn(`⚠️ ${role} stats missing for matchup ${matchup_id}`);
        continue;
      }

      // — pull out the 10 numbers
      const allB = await statRow.$$eval('td b', bs => bs.map(b => b.innerText.trim()));
      const nums = allB.slice(1);
      if (nums.length < 10) {
        console.warn(`⚠️ unexpected # columns (${nums.length}) for ${role} of ${matchup_id}`);
        continue;
      }

      // parse
      const [
        ip_s,h_s,r_s,er_s,
        so_s,bb_s,hr_s,pit_s,
        pip_s,gbfb_s
      ] = nums;

      const ip   = parseFloat(ip_s)  || 0;
      const h    = parseFloat(h_s)   || 0;
      const r    = parseFloat(r_s)   || 0;
      const er   = parseFloat(er_s)  || 0;
      const so   = parseFloat(so_s)  || 0;
      const bb   = parseFloat(bb_s)  || 0;
      const hr   = parseFloat(hr_s)  || 0;
      const pit  = parseFloat(pit_s) || 0;
      const pip  = parseFloat(pip_s) || 0;
      const gbfb = parseFloat(gbfb_s)|| 0;

      // compute ERA, ERA+, WHIP
      const era      = ip>0 ? +((er/ip*9).toFixed(2)) : null;
      const era_plus = era    ? Math.round(100*(4.1/era)) : null;
      const whip     = ip>0 ? +(((bb+h)/ip).toFixed(3)) : null;

      rows.push({
        matchup_id,
        pitcher_role: role,
        team_name,
        team_id,
        pitcher_name,
        ip, h, r, er, so, bb, hr, pit, pip, gbfb,
        era, era_plus, whip
      });
    }
  }

  await browser.close();
  console.log(`→ Scraped ${rows.length} pitcher‑records`);
  if (DEBUG) console.log(JSON.stringify(rows,null,2));
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
      console.warn('⚠️ No pitching stats found');
      await createScrapeReport({
        success: false,
        error:   'No pitching stats found',
        timestamp: new Date().toISOString(),
        stats: { records: 0 }
      });
      return;
    }

    console.log(`→ Upserting ${stats.length} records to Supabase…`);
    const { data, error } = await supabase
      .from('pitching_matchups')
      .upsert(stats, { onConflict: ['matchup_id','pitcher_role'] })
      .select();

    if (error) throw error;

    console.log(`✅ Saved ${data.length} pitching records`);
    await createScrapeReport({
      success: true,
      timestamp: new Date().toISOString(),
      stats: { records: data.length },
      records: data
    });

  } catch (err) {
    console.error('❌ Error inserting pitching stats:', err.message);
    await createScrapeReport({
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
