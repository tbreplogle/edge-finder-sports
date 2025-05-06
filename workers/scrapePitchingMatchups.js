// workers/scrapePitchingMatchups.js
import puppeteer from 'puppeteer';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

const DEBUG = process.env.DEBUG === 'true';

// map every possible Covers.com tab label → your teams_mlb.team_id
const TEAM_ALT_NAME_TO_ID = {
  'SEATTLE':             1,
  'CLEVELAND':           2,
  'PITTSBURGH':          3,
  'LA ANGELS':           4,
  'LOS ANGELES ANGELS':  4,
  'TORONTO':             5,
  'MIAMI':               6,
  'ATHLETICS':           7,
  'NY YANKEES':          8,
  'TAMPA BAY':           9,
  'MINNESOTA':          10,
  'KANSAS CITY':        11,
  'SF GIANTS':          12,
  'SAN FRANCISCO':      12,
  'ARIZONA':            13,
  'MILWAUKEE':          14,
  'CHI. WHITE SOX':     15,
  'CHI. CUBS':          16,
  'ATLANTA':            17,
  'SAN DIEGO':          18,
  'HOUSTON':            19,
  'NY METS':            20,
  'LA DODGERS':         21,
  'LOS ANGELES DODGERS':21,
  'COLORADO':           22,
  'CINCINNATI':         23,
  'WASHINGTON':         24,
  'DETROIT':            25,
  'PHILADELPHIA':       26,
  'ST. LOUIS':          27,
  'TEXAS':              28,
  'BOSTON':             29,
  'BALTIMORE':          30
};

async function scrapePitchingMatchups() {
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
    await page.goto(url, { waitUntil:'networkidle2', timeout:60000 });
    await page.waitForSelector('a[href="#away-team-last-5"]', { timeout:30000 });

    // helper to scrape one side
    async function scrapeSide(prefix, role) {
      const rawLabel = await page.$eval(
        `a[href="#${prefix}-team-last-5"]`,
        el => el.innerText.trim().toUpperCase()
      );
      const team_id = TEAM_ALT_NAME_TO_ID[rawLabel];
      const pitcher_name = await page.$eval(
        `#${prefix}-team-last-5 a.anchor-with-border`,
        el => el.innerText.trim()
      );
      const vals = await page.$$eval(
        `#${prefix}-team-last-5 table tr`,
        trs => {
          const tr = trs.find(r =>
            r.querySelector('td b')?.innerText.trim() === 'Last 5 Avg.'
          );
          if (!tr) return [];
          return Array.from(tr.querySelectorAll('td b'))
                      .map(b => b.innerText.trim())
                      .slice(1);
        }
      );
      if (vals.length !== 10) {
        console.warn(`⚠️ ${role} stats missing for ${matchup_id}`);
        return;
      }
      const [ip,h,r,er,so,bb,hr,pit,pip,gbfb] = vals;
      rows.push({ matchup_id, pitcher_role:role, team_name:rawLabel, team_id, pitcher_name, ip,h,r,er,so,bb,hr,pit,pip,gbfb });
    }

    await scrapeSide('away','away');
    await scrapeSide('home','home');
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
      createScrapeReport({ success:false, error:'No pitching stats found', timestamp:new Date().toISOString(), stats:{records:0} });
      return;
    }

    // cast & compute ERA, ERA+, WHIP
    const enriched = stats.map(r => {
      const ipVal  = parseFloat(r.ip)||0;
      const hVal   = +r.h;
      const rVal   = +r.r;
      const erVal  = +r.er;
      const soVal  = +r.so;
      const bbVal  = +r.bb;
      const hrVal  = +r.hr;
      const pitVal = +r.pit;
      const pipVal = parseFloat(r.pip)||null;
      const gbfbVal= parseFloat(r.gbfb)||null;

      const eraVal     = ipVal>0 ? +( (erVal/ipVal)*9 ).toFixed(2) : null;
      const eraPlusVal = eraVal ? +((100*(4.1/eraVal))).toFixed(0) : null;
      const whipVal    = ipVal>0 ? +(((bbVal+hVal)/ipVal)).toFixed(3) : null;

      return {
        matchup_id:   r.matchup_id,
        pitcher_role: r.pitcher_role,
        team_name:    r.team_name,
        team_id:      r.team_id,
        pitcher_name: r.pitcher_name,
        ip:      +ipVal.toFixed(1),
        h:       hVal,
        r:       rVal,
        er:      erVal,
        so:      soVal,
        bb:      bbVal,
        hr:      hrVal,
        pit:     pitVal,
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
      .upsert(enriched, { onConflict:['matchup_id','pitcher_role'] })
      .select();

    if (error) throw error;
    console.log(`✅ Saved ${data.length} pitching records`);
    createScrapeReport({ success:true, timestamp:new Date().toISOString(), stats:{records:data.length}, records:data });
  }
  catch (err) {
    console.error('❌ Error inserting pitching stats:', err);
    createScrapeReport({ success:false, error:err.message, timestamp:new Date().toISOString(), stats:{records:0} });
  }
}

// auto‑run if called directly
if (import.meta.url.endsWith('scrapePitchingMatchups.js')) {
  scrapeAndSavePitchingMatchups()
    .then(()=>process.exit(0))
    .catch(()=>process.exit(1));
}
