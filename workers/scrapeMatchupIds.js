/* workers/scrapeMatchupIds.js
   -------------------------------------------------------------
   Scrapes today’s MLB matchup IDs + teams from Covers.com and
   upserts into the `mlb_matchups` table.
   ▸ Handles both the new “/matchups” page and the older
     scoreboard layout, plus lazy-loaded content.
   ▸ Saves one row per game: {matchup_id, game_id, …}
   ------------------------------------------------------------*/

import puppeteer from 'puppeteer';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

const DEBUG = process.env.DEBUG === 'true';
const TODAY = new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------
   Hard-coded Covers team-label → teams_mlb.team_id mapping
------------------------------------------------------------ */
const TEAM_NAME_TO_ID = {
  // home teams
  'WASHINGTON': 24, 'ATLANTA': 17, 'TAMPA BAY': 9,  'BOSTON': 29,
  'COLORADO': 22,   'MILWAUKEE': 14, 'KANSAS CITY': 11, 'MINNESOTA': 10,
  'ST. LOUIS': 27,  'CHI. CUBS': 16, 'NY YANKEES': 8,  'MIAMI': 6,
  'ATHLETICS': 7,   'LA ANGELS': 4,  'ARIZONA': 13,

  // away teams
  'CLEVELAND': 2,  'CINCINNATI': 23, 'PHILADELPHIA': 26, 'TEXAS': 28,
  'DETROIT': 25,   'HOUSTON': 19,    'CHI. WHITE SOX': 15, 'BALTIMORE': 30,
  'PITTSBURGH': 3, 'SAN FRANCISCO': 12, 'SAN DIEGO': 18,   'LA DODGERS': 21,
  'SEATTLE': 1,    'TORONTO': 5,     'NY METS': 20
};

/* ───────────────── helpers for each page layout ───────────────── */
function parseMatchupBox(el) {
  const href = el.querySelector('a[href*="/matchup/"]')?.href ?? '';
  const id   = href.match(/(\d+)$/)?.[1];
  if (!id) return null;

  const [away, home] =
    el.querySelector('strong.text-uppercase')?.innerText.split('@').map(s => s.trim().toUpperCase()) ?? [];

  return { matchup_id: id, game_id: id, away_team: away, home_team: home, game_date: TODAY };
}

function parseScoreboardRow(el) {
  const href = el.querySelector('a[href*="/matchup/"]')?.href ?? '';
  const id   = href.match(/(\d+)$/)?.[1];
  if (!id) return null;

  const teams = el.querySelectorAll('.cmg_matchup_header_teamNames > a');
  if (teams.length !== 2) return null;
  const away = teams[0].innerText.trim().toUpperCase();
  const home = teams[1].innerText.trim().toUpperCase();

  return { matchup_id: id, game_id: id, away_team: away, home_team: home, game_date: TODAY };
}

/* ───────────────── core scraper ───────────────── */
async function grabGames(page, url, variant) {
  console.log(`→ Opening ${url}`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });

  /* kick IntersectionObserver so lazy components render */
  await page.evaluate(() => window.scrollBy(0, 400));

  const selector = variant === 'matchups' ? 'article.gamebox' : 'div.cmg_game_data';
  try {
    await page.waitForSelector(selector, { timeout: 12_000 });
  } catch {
    console.warn('⚠️  no game boxes rendered (timeout)');
    return [];
  }

  return variant === 'matchups'
    ? (await page.$$eval(selector, nodes => nodes.map(n => {
        /* inline the parsing helper for isolated context */
        const link = n.querySelector('a[href*="/matchup/"]');
        const id   = link?.href.match(/(\d+)$/)?.[1];
        if (!id) return null;
        const [a,h] = n.querySelector('strong.text-uppercase')?.innerText.split('@').map(s => s.trim().toUpperCase()) ?? [];
        return { matchup_id:id, game_id:id, away_team:a, home_team:h, game_date:'${TODAY}' };
      }))).filter(Boolean)
    : (await page.$$eval(selector, nodes => nodes.map(n => {
        const link = n.querySelector('a[href*="/matchup/"]');
        const id   = link?.href.match(/(\d+)$/)?.[1];
        if (!id) return null;
        const teams = n.querySelectorAll('.cmg_matchup_header_teamNames > a');
        if (teams.length !== 2) return null;
        return { matchup_id:id, game_id:id, away_team:teams[0].innerText.trim().toUpperCase(),
                 home_team:teams[1].innerText.trim().toUpperCase(), game_date:'${TODAY}' };
      }))).filter(Boolean);
}

async function scrapeTodayMatchups() {
  const browser = await puppeteer.launch({ channel:'chrome', headless:'new', args:['--no-sandbox','--disable-setuid-sandbox'] });
  const page    = await browser.newPage();
  await page.setViewport({ width:1920, height:1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');

  const base = 'https://www.covers.com/sport/baseball/mlb';
  let games  = await grabGames(page, `${base}/matchups?selectedDate=${TODAY}`, 'matchups');

  /* fallback to old scoreboard if nothing came back */
  if (games.length === 0) {
    games = await grabGames(page, `${base}/scoreboard?selectedDate=${TODAY}`, 'scoreboard');
  }

  await browser.close();
  console.log(`→ Scraped ${games.length} games`);
  if (DEBUG) console.log(JSON.stringify(games,null,2));
  return games;
}

/* ───────────────── save helper ───────────────── */
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
    home_team_id: TEAM_NAME_TO_ID[r.home_team] ?? null
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

/* run directly */
if (import.meta.url.endsWith('scrapeMatchupIds.js')) {
  scrapeAndSaveTodayMatchups()
    .then(res => process.exit(res.success ? 0 : 1))
    .catch(() => process.exit(1));
}
