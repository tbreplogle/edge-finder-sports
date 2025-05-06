// workers/scrapePitchingMatchups.js
import puppeteer from 'puppeteer';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

const DEBUG = process.env.DEBUG === 'true';

/**
 * Map from your teams_mlb.alt_name to team_id
 */
const TEAM_ALT_NAME_TO_ID = {
  'SEATTLE':        1,
  'CLEVELAND':      2,
  'PITTSBURGH':     3,
  'LA ANGELS':      4,
  'TORONTO':        5,
  'MIAMI':          6,
  'ATHLETICS':      7,
  'NY YANKEES':     8,
  'TAMPA BAY':      9,
  'MINNESOTA':     10,
  'KANSAS CITY':    11,
  'SF GIANTS':      12,
  'ARIZONA':        13,
  'MILWAUKEE':      14,
  'CHI. WHITE SOX': 15,
  'CHI. CUBS':      16,
  'ATLANTA':        17,
  'SAN DIEGO':      18,
  'HOUSTON':        19,
  'NY METS':        20,
  'LA DODGERS':     21,
  'COLORADO':       22,
  'CINCINNATI':     23,
  'WASHINGTON':     24,
  'DETROIT':        25,
  'PHILADELPHIA':   26,
  'ST. LOUIS':      27,
  'TEXAS':          28,
  'BOSTON':         29,
  'BALTIMORE':      30
};

async function scrapePitchingMatchups() {
  // 1) get today's matchup_ids
  const today = new Date().toISOString().slice(0,10);
  const { data: games, error: fetchErr } = await supabase
    .from('mlb_matchups')
    .select('matchup_id')
    .eq('game_date', today);

  if (fetchErr) throw new Error('Loading today matchups failed: ' + fetchErr.message);
  if (!games.length) {
    console.warn('⚠️ No matchups for today.');
    return [];
  }
  console.log(`→ Found ${games.length} matchups to scrape.`);

  // 2) launch Puppeteer
  const browser = await puppeteer.launch({
    args: ['--no-sandbox','--disable-setuid-sandbox'],
    headless: 'new'
  });
  const page = await browser.newPage();
  await page.setViewport({ width:1920, height:1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');

  const rows = [];

  for (const { matchup_id } of games) {
    const url = `https://www.covers.com/sport/baseball/mlb/matchup/${matchup_id}`;
    console.log(`→ Loading ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('a[href="#away-team-last-5"]', { timeout: 30000 });

    for (const role of ['away','home']) {
      const tab = role === 'away' ? '#away-team-last-5' : '#home-team-last-5';

      // team name (alt_name)
      const team_name = await page.$eval(
        `a[href="${tab}"]`,
        el => el.innerText.trim().toUpperCase()
      );

      // map to your team_id
      const team_id = TEAM_ALT_NAME_TO_ID[team_name] ?? null;
      if (!team_id) {
        console.warn(`⚠️ No team_id mapping for "${team_name}"`);
      }

      // pitcher name
      const pitcher_name = await page.$eval(
        `${tab} a.anchor-with-border`,
        el => el.innerText.trim()
      );

      // grab the "Last 5 Avg." row
      const vals = await page.$$eval(
        `${tab} table tr`,
        trs => {
          const row = trs.find(r => {
            const b = r.querySelector('td b');
            return b?.innerText.trim() === 'Last 5 Avg.';
          });
          if (!row) return [];
          // collect each <b>…</b> cell, skip the first (label)
          return Array.from(row.querySelectorAll('td b'))
                      .map(b => b.innerText.trim())
                      .slice(1);
        }
      );

      if (vals.length !== 10) {
        console.warn(`⚠️ ${role} stats missing for matchup ${matchup_id}`);
        continue;
      }

      // destructure and parse
      let [ ip, h, r, er, so, bb, hr, pit, pip, gbfb ] = vals;
      const ip_n   = parseFloat(ip) || 0;
      const h_n    = parseInt(h,10)     || 0;
      const r_n    = parseInt(r,10)     || 0;
      const er_n   = parseInt(er,10)    || 0;
      const so_n   = parseInt(so,10)    || 0;
      const bb_n   = parseInt(bb,10)    || 0;
      const hr_n   = parseInt(hr,10)    || 0;
      const pit_n  = parseInt(pit,10)   || 0;
      const pip_n  = parseFloat(pip)    || 0;
      const gbfb_n = parseFloat(gbfb)   || 0;

      // ERA, ERA+, WHIP
      const era    = ip_n > 0 ? +( (er_n / ip_n) * 9 ).toFixed(2) : null;
      const era_plus = era ? Math.round(100 * (4.1 / era)) : null;
      const whip   = ip_n > 0 ? +(((bb_n + h_n) / ip_n).toFixed(3)) : null;

      rows.push({
        matchup_id,
        pitcher_role: role,
        team_name,
        team_id,
        pitcher_name,
        ip:   ip_n,
        h:    h_n,
        r:    r_n,
        er:   er_n,
        so:   so_n,
        bb:   bb_n,
        hr:   hr_n,
        pit:  pit_n,
        pip:  pip_n,
        gbfb: gbfb_n,
        era,
        era_plus,
        whip
      });
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
    console.error('❌ Supabase connection failed');
    process.exit(1);
  }

  try {
    const stats = await scrapePitchingMatchups();
    if (!stats.length) {
      console.warn('⚠️ No pitching stats found');
      createScrapeReport({
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
      .upsert(stats, {
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
