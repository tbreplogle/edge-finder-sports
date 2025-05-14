/* workers/scrapeMatchupIds.js
   -------------------------------------------------------------
   ❶ scroll-kick to trigger lazy rendering
   ❷ if the modern “matchups” page has zero boxes we switch to the
      old scoreboard page and use its markup
   ------------------------------------------------------------*/

import puppeteer from 'puppeteer';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

const TEAM_NAME_TO_ID = { /* …unchanged map – snipped for brevity… */ };
const DEBUG = process.env.DEBUG === 'true';

const TODAY = new Date().toISOString().slice(0, 10);

/* ───────────────── scrape a single URL ──────────────────── */
async function grabMatches(page, url, variant) {
  console.log(`→ Opening ${url}`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
  await page.evaluate(() => window.scrollBy(0, 400));          // kick lazy load

  try {
    if (variant === 'matchups') {
      await page.waitForSelector('article.gamebox', { timeout: 12_000 });
      return await page.$$eval('article.gamebox', parseMatchupBox);
    } else {
      await page.waitForSelector('div.cmg_game_data', { timeout: 12_000 });
      return await page.$$eval('div.cmg_game_data', parseScoreboardRow);
    }
  } catch {
    console.warn('⚠️  selector timeout – no games rendered');
    return [];
  }
}

/* === helpers for the two layouts === */
function parseMatchupBox(el) {
  const id = el.querySelector('a[href*="/matchup/"]')?.href.match(/(\d+)$/)?.[1];
  if (!id) return null;
  const [away, home] = el.querySelector('strong.text-uppercase')?.innerText.split('@').map(s => s.trim().toUpperCase()) ?? [];
  const date = el.querySelector('strong.preGame-status')?.innerText.trim();
  return { matchup_id: id, game_id: id, away_team: away, home_team: home, game_date: TODAY };
}

function parseScoreboardRow(el) {
  const link = el.querySelector('a[href*="/matchup/"]');
  if (!link) return null;
  const id = link.href.match(/(\d+)$/)?.[1];
  const teams = el.querySelectorAll('.cmg_matchup_header_teamNames > a');
  if (teams.length !== 2) return null;
  const home = teams[1].innerText.trim().toUpperCase();
  const away = teams[0].innerText.trim().toUpperCase();
  return { matchup_id: id, game_id: id, away_team: away, home_team: home, game_date: TODAY };
}

/* ───────────────── FULL scrape routine ──────────────────── */
async function scrapeTodayMatchups() {
  const browser = await puppeteer.launch({ channel: 'chrome', headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page     = await browser.newPage();
  await page.setViewport({ width:1920, height:1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');

  /* first try the new “matchups” page */
  const base    = 'https://www.covers.com/sport/baseball/mlb';
  let games = await grabMatches(page, `${base}/matchups?selectedDate=${TODAY}`, 'matchups');

  /* fallback to scoreboard layout */
  if (games.length === 0) {
    games = await grabMatches(page, `${base}/scoreboard?selectedDate=${TODAY}`, 'scoreboard');
  }

  await browser.close();
  const filtered = games.filter(Boolean);
  console.log(`→ Scraped ${filtered.length} games`);
  if (DEBUG) console.log(JSON.stringify(filtered,null,2));
  return filtered;
}

/* ───────────────── save to Supabase ───────────────── */
export async function scrapeAndSaveTodayMatchups() {
  console.log('⏳ MLB matchup scraper starting…');
  if (!(await testConnection())) throw new Error('Supabase unreachable');

  const rows = await scrapeTodayMatchups();
  if (!rows.length) {
    await createScrapeReport({ success:false, error:'No matchups found', timestamp:new Date().toISOString(), stats:{matchups:0}});
    return { success:false, matchups:[] };
  }

  const enriched = rows.map(r => ({
    ...r,
    away_team_id: TEAM_NAME_TO_ID[r.away_team] ?? null,
    home_team_id: TEAM_NAME_TO_ID[r.home_team] ?? null,
  }));

  const { data, error } = await supabase
    .from('mlb_matchups')
    .upsert(enriched, { onConflict:['matchup_id'] })
    .select();

  if (error) throw error;

  await createScrapeReport({
    success:true,
    timestamp:new Date().toISOString(),
    stats:{matchups:data.length},
    matchups:data
  });
  console.log(`✅ Saved ${data.length} rows`);
  return { success:true, matchups:data };
}

if (import.meta.url.endsWith('scrapeMatchupIds.js')) {
  scrapeAndSaveTodayMatchups()
    .then(res => process.exit(res.success ? 0 : 1))
    .catch(() => process.exit(1));
}
