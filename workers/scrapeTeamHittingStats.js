/* --------------------------------------------------------------------------
   workers/scrapeTeamHittingStats.js
   – Scrapes FanGraphs team-hitting table and upserts to Supabase
   – Always writes scrape-result.json
   – Cleans up rows > 90 days old WITHOUT needing the exec_sql RPC
--------------------------------------------------------------------------- */

import fs                         from 'fs';
import puppeteer                  from 'puppeteer';
import { format, subDays }        from 'date-fns';
import {
  supabase,
  testConnection,
  createScrapeReport
}                                 from './lib/supabaseClient.js';

const DEBUG = process.env.DEBUG === 'true';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */
function iso(d) { return format(d, 'yyyy-MM-dd'); }

/* -------------------------------------------------------------------------- */
/* Scraper                                                                    */
/* -------------------------------------------------------------------------- */
async function scrapeTeamHittingStats() {
  // ── launch cached Chrome ────────────────────────────────────────────────
  const browser = await puppeteer.launch({
    headless : 'new',
    channel  : 'chrome',                       // use system Chrome from cache
    args     : ['--no-sandbox','--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const today = new Date();
  const url   = `https://www.fangraphs.com/leaders?pos=all&stats=bat&lg=all&qual=y&type=8&season=${today.getFullYear()}&month=0&season1=${today.getFullYear()}&ind=0`;

  console.log('→ Opening', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });

  // wait for the table to render
  await page.waitForSelector('#LeaderBoard1_dg1_ctl00 tbody tr', {
    timeout: 30_000
  });

  // extract rows
  const rows = await page.$$eval('#LeaderBoard1_dg1_ctl00 tbody tr', trs => {
    return trs.map(tr => {
      const tds = [...tr.querySelectorAll('td')].map(td => td.textContent.trim());
      return {
        team_name     : tds[1],
        games_played  : +tds[2],
        at_bats       : +tds[3],
        runs          : +tds[4],
        hits          : +tds[5],
        doubles       : +tds[6],
        triples       : +tds[7],
        home_runs     : +tds[8],
        rbi           : +tds[9],
        bb            : +tds[10],
        so            : +tds[11],
        avg           : +tds[12],
        obp           : +tds[13],
        slg           : +tds[14],
        ops           : +tds[15],
        game_date     : new Date().toISOString().slice(0,10), // today
      };
    });
  });

  await browser.close();
  console.log(`→ Scraped ${rows.length} team stats records`);
  if (DEBUG) console.log(JSON.stringify(rows.slice(0,3), null, 2)); // preview
  return rows;
}

/* -------------------------------------------------------------------------- */
/* Main runner                                                                */
/* -------------------------------------------------------------------------- */
export async function scrapeAndSaveTeamHittingStats() {
  console.log('⏳ MLB team-hitting stats update starting…');
  let report   = {};
  let inserted = 0;

  try {
    if (!(await testConnection())) {
      throw new Error('Supabase connection failed');
    }

    // 1) scrape
    const rows = await scrapeTeamHittingStats();

    // 2) upsert
    console.log(`→ Upserting ${rows.length} rows to Supabase…`);
    const { error } = await supabase
      .from('mlb_team_hitting_stats')
      .upsert(rows, { onConflict: ['team_name','game_date'] });

    if (error) throw error;
    inserted = rows.length;
    console.log('✅ Successfully saved team hitting stats to Supabase');

    // 3) delete anything older than 90 days (no exec_sql RPC)
    const cutoff = subDays(new Date(), 90);
    console.log('→ Removing rows older than', iso(cutoff));
    const { error: delErr } = await supabase
      .from('mlb_team_hitting_stats')
      .delete()
      .lt('game_date', iso(cutoff));

    if (delErr) throw delErr;

    report = { success: true, stats: { seven_day: inserted } };
    console.log(`✅ MLB team hitting stats update completed successfully in ${((Date.now()-cutoff)/1e3).toFixed(2)}s`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    report = { success: false, error: err.message };
  } finally {
    // always write the JSON file for the workflow step that verifies results
    fs.writeFileSync('scrape-result.json', JSON.stringify(report, null, 2));
    console.log('✓ Scrape report saved to scrape-result.json');

    // plus a row in scrape_history (optional helper)
    await createScrapeReport({
      ...report,
      timestamp: new Date().toISOString(),
    });
  }
}

/* Run directly from CLI ---------------------------------------------------- */
if (import.meta.url.endsWith('scrapeTeamHittingStats.js')) {
  scrapeAndSaveTeamHittingStats()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
