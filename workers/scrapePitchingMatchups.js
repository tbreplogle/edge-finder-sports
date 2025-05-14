/* workers/scrapePitchingMatchups.js
   Scrapes Covers matchup pages for starting-pitcher & “last-5” stats
   – saves **one row per game side** keyed on (matchup_id, pitcher_role)
*/

import puppeteer from 'puppeteer';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

const DEBUG = process.env.DEBUG === 'true';

/* team-label → team_id map (same values as before) */
const TEAM_ALT_NAME_TO_ID = { /* …snipped for brevity… */ };

/* ─────────────── helper: scrape all games with odds today ─────────────── */
async function scrapePitchingMatchups() {
  const today = new Date().toISOString().slice(0,10);

  /* grab game + matchup IDs from mlb_market_odds – always has game_id */
  const { data: games, error } = await supabase
    .from('mlb_market_odds')
    .select('matchup_id, game_id')
    .eq('game_date', today);

  if (error) throw new Error(error.message);
  if (!games.length) {
    console.warn('⚠️  No games with odds today');
    return [];
  }

  const browser = await puppeteer.launch({ channel:'chrome', headless:'new', args:['--no-sandbox','--disable-setuid-sandbox'] });
  const page    = await browser.newPage();
  await page.setViewport({ width:1920, height:1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');

  const rows = [];
  for (const { matchup_id, game_id } of games) {
    const url = `https://www.covers.com/sport/baseball/mlb/matchup/${matchup_id}`;
    console.log(`→ Loading ${url}`);
    await page.goto(url, { waitUntil:'networkidle2', timeout:60_000 });
    try {
      await page.waitForSelector('a[href="#away-team-last-5"]', { timeout:30_000 });
    } catch {
      console.warn(`⚠️  page load failed for matchup ${matchup_id}`);
      continue;
    }

    for (const role of ['away','home']) {
      const tab = role === 'away' ? '#away-team-last-5' : '#home-team-last-5';

      /* team */
      let team_name = null, team_id = null;
      try {
        team_name = await page.$eval(`a[href="${tab}"]`, el => el.innerText.trim().toUpperCase());
        team_id   = TEAM_ALT_NAME_TO_ID[team_name] ?? null;
      } catch {/* ignore */}
      /* pitcher */
      let pitcher_name = null;
      try { pitcher_name = await page.$eval(`${tab} a.anchor-with-border`, el => el.innerText.trim()); }
      catch { continue; }

      /* stats row */
      const statRow = await page.$$eval(`${tab} table tr`, rows =>
        rows.find(r => r.querySelector('td b')?.innerText.toLowerCase().includes('last') ) ?? null );
      if (!statRow) continue;

      const nums = await page.$$eval(`${tab} table tr td b`, bs => bs.map(b => b.innerText.trim()).slice(1));
      if (nums.length < 10) continue;

      const [ip,h,r,er,so,bb,hr,pit,pip,gbfb] = nums.map(n => parseFloat(n) || 0);
      const era      = ip ? +((er/ip)*9).toFixed(2) : null;
      const era_plus = era ? Math.round(100 * 4.1 / era) : null;
      const whip     = ip ? +(((bb+h)/ip).toFixed(3))  : null;

      rows.push({
        game_id, matchup_id, pitcher_role: role,
        team_name, team_id, pitcher_name,
        ip,h,r,er,so,bb,hr,pit,pip,gbfb,era,era_plus,whip
      });
    }
  }

  await browser.close();
  console.log(`→ Scraped ${rows.length} pitcher records`);
  if (DEBUG) console.log(JSON.stringify(rows,null,2));
  return rows;
}

/* ─────────────── save helper ─────────────── */
export async function scrapeAndSavePitchingMatchups() {
  console.log('⏳ Starting pitching-matchups scraper…');
  if (!(await testConnection())) throw new Error('Supabase unreachable');

  const rows = await scrapePitchingMatchups();
  if (!rows.length) {
    await createScrapeReport({ success:false, error:'No pitching stats found', timestamp:new Date().toISOString(), stats:{records:0}});
    return;
  }

  console.log(`→ Upserting ${rows.length} rows…`);
  const { data, error } = await supabase
    .from('pitching_matchups')
    .upsert(rows, { onConflict:['matchup_id','pitcher_role'] })   // correct PK
    .select();
  if (error) throw error;

  console.log(`✅ Saved ${data.length} pitching records`);
  await createScrapeReport({
    success:true,
    timestamp:new Date().toISOString(),
    stats:{records:data.length}
  });
}

/* run directly */
if (import.meta.url.endsWith('scrapePitchingMatchups.js')) {
  scrapeAndSavePitchingMatchups()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
