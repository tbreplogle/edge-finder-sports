/* workers/scrapeTeamHittingStats.js
   Scrapes FanGraphs team-hitting table, upserts to Supabase, always
   writes scrape-result.json, and cleans rows older than 90 days. */

import fs              from 'fs';
import puppeteer       from 'puppeteer';
import { format, subDays } from 'date-fns';
import {
  supabase,
  testConnection,
  createScrapeReport,
} from './lib/supabaseClient.js';

const DEBUG = process.env.DEBUG === 'true';
const TODAY = new Date().toISOString().slice(0, 10);
const iso   = (d) => format(d, 'yyyy-MM-dd');

/* ─────────────────────────────────────────────────────────────── */
/* Scrape helper                                                  */
/* ─────────────────────────────────────────────────────────────── */
async function scrapeTeamHittingStats() {
  const browser = await puppeteer.launch({
    headless: 'new',
    channel:  'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1024 });

  const year = new Date().getFullYear();
  const url =
    `https://www.fangraphs.com/leaders?pos=all&stats=bat&lg=all&qual=y&type=8` +
    `&season=${year}&month=0&season1=${year}&ind=0`;

  console.log('→ Opening', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });

  /* kick the grid’s lazy-loader */
  await page.evaluate(() => window.scrollBy(0, 600));

  /* wait for either old ID-grid or new rgMasterTable rows */
  const selectorA = '#LeaderBoard1_dg1_ctl00 tbody tr';
  const selectorB = '.rgMasterTable tbody tr';
  try {
    await page.waitForFunction(
      (sel1, sel2) =>
        document.querySelector(sel1) || document.querySelector(sel2),
      { timeout: 45_000 },
      selectorA,
      selectorB
    );
  } catch {
    console.warn('⚠️  FanGraphs table did not render within 45 s');
  }

  /* choose whichever selector exists */
  const rowSelector =
    (await page.$$(selectorA)).length ? selectorA : selectorB;

  const rows = await page.$$eval(rowSelector, (trs) =>
    trs.map((tr) => {
      const tds = [...tr.querySelectorAll('td')].map((td) =>
        td.textContent.trim()
      );
      return {
        team_name: tds[1],
        games_played: +tds[2],
        at_bats: +tds[3],
        runs: +tds[4],
        hits: +tds[5],
        doubles: +tds[6],
        triples: +tds[7],
        home_runs: +tds[8],
        rbi: +tds[9],
        bb: +tds[10],
        so: +tds[11],
        avg: +tds[12],
        obp: +tds[13],
        slg: +tds[14],
        ops: +tds[15],
        game_date: new Date().toISOString().slice(0, 10),
      };
    })
  );

  await browser.close();
  console.log(`→ Scraped ${rows.length} team-stat records`);
  if (DEBUG) console.log(JSON.stringify(rows.slice(0, 3), null, 2));
  return rows;
}

/* ─────────────────────────────────────────────────────────────── */
/* Main runner                                                    */
/* ─────────────────────────────────────────────────────────────── */
export async function scrapeAndSaveTeamHittingStats() {
  console.log('⏳ MLB team-hitting stats update starting…');
  let report = { success: false, error: 'Unknown error' };

  try {
    if (!(await testConnection())) throw new Error('Supabase connection failed');

    const rows = await scrapeTeamHittingStats();
    if (!rows.length) throw new Error('Scraper returned 0 rows');

    /* upsert */
    console.log(`→ Upserting ${rows.length} rows…`);
    const { error } = await supabase
      .from('mlb_team_hitting_stats')
      .upsert(rows, { onConflict: ['team_name', 'game_date'] });
    if (error) throw error;

    /* cleanup older than 90 days */
    const cutoff = iso(subDays(new Date(), 90));
    await supabase
      .from('mlb_team_hitting_stats')
      .delete()
      .lt('game_date', cutoff);

    console.log('✅ Team-hitting stats saved & cleanup done');
    report = { success: true, stats: { inserted: rows.length } };
  } catch (err) {
    console.error('❌', err.message);
    report = { success: false, error: err.message };
  } finally {
    fs.writeFileSync('scrape-result.json', JSON.stringify(report, null, 2));
    console.log('✓ scrape-result.json written');
    await createScrapeReport({
      ...report,
      timestamp: new Date().toISOString(),
    });
  }
}

/* run when executed directly */
if (import.meta.url.endsWith('scrapeTeamHittingStats.js')) {
  scrapeAndSaveTeamHittingStats()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
