// workers/scrapePitchingMatchups.js
import puppeteer from 'puppeteer';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

const DEBUG = process.env.DEBUG === 'true';

async function loadTodayMatchups() {
  try {
    const { data, error } = await supabase
      .from('mlb_matchups')
      .select('matchup_id');
    if (error) throw error;
    return data.map(r => r.matchup_id);
  } catch (err) {
    // fixed: use double‑quotes so the apostrophes inside don’t break the JS string
    console.error("❌ Couldn't load today's matchups:", err);
    return [];
  }
}

async function scrapePitchingMatchups() {
  const matchupIds = await loadTodayMatchups();
  if (!matchupIds.length) {
    console.warn('⚠️  No matchup IDs to process.');
    return [];
  }
  console.log(`→ Will scrape pitching stats for ${matchupIds.length} games`);

  const browser = await puppeteer.launch({
    args: ['--no-sandbox','--disable-setuid-sandbox'],
    headless: 'new'
  });

  const records = [];

  for (const id of matchupIds) {
    const url = `https://www.covers.com/sport/baseball/mlb/matchup/${id}`;
    console.log(`→ Loading ${url}`);
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('a.anchor-with-border', { timeout: 30000 });
    if (DEBUG) await page.screenshot({ path: `debug-pitching-${id}.png` });

    // grab the two pitcher links (away first, home second)
    const pitchers = await page.$$eval(
      'a.anchor-with-border',
      els => els.slice(0,2).map(a => a.innerText.trim())
    );
    const [awayName, homeName] = pitchers;

    // find the “Last 5 Avg.” row and pull out all <b> values
    const allRows = await page.$$eval(
      'table tbody tr',
      rows => rows.map(r => ({
        title: r.querySelector('td b')?.innerText.trim(),
        stats: Array.from(r.querySelectorAll('b')).map(b => b.innerText.trim())
      }))
    );

    const mapStats = arr => ({
      ip:       parseFloat(arr[3] || 0),
      h:        parseFloat(arr[4] || 0),
      r:        parseFloat(arr[5] || 0),
      er:       parseFloat(arr[6] || 0),
      so:       parseFloat(arr[7] || 0),
      bb:       parseFloat(arr[8] || 0),
      hr:       parseFloat(arr[9] || 0),
      pit:      parseFloat(arr[10]|| 0),
      pip:      parseFloat(arr[11]|| 0),
      gbfb:     parseFloat(arr[12]|| 0),
    });

    const awayRow = allRows.find(r => r.title === 'Last 5 Avg.');
    const homeRow = allRows.slice(allRows.indexOf(awayRow)+1).find(r => r.title === 'Last 5 Avg.');

    records.push({
      matchup_id: id,
      pitcher_role: 'away',
      name: awayName,
      ...mapStats(awayRow?.stats || [])
    });

    records.push({
      matchup_id: id,
      pitcher_role: 'home',
      name: homeName,
      ...mapStats(homeRow?.stats || [])
    });

    await page.close();
  }

  await browser.close();
  return records;
}

async function main() {
  console.log('⏳ Starting pitching-matchups scraper…');
  if (!(await testConnection())) {
    console.error('❌ Supabase connection failed, aborting.');
    process.exit(1);
  }

  const data = await scrapePitchingMatchups();
  if (!data.length) {
    createScrapeReport({
      success: false,
      error: 'No pitching data found',
      timestamp: new Date().toISOString(),
      stats: { records: 0 }
    });
    return;
  }

  console.log(`→ Inserting ${data.length} pitching records into Supabase…`);
  const { error } = await supabase
    .from('pitching_matchups')
    .insert(data);

  if (error) {
    console.error('❌ Supabase insert error:', error);
    createScrapeReport({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      stats: { records: 0 }
    });
  } else {
    console.log(`✅ Successfully inserted ${data.length} records`);
    createScrapeReport({
      success: true,
      timestamp: new Date().toISOString(),
      stats: { records: data.length }
    });
  }
}

if (import.meta.url.endsWith('scrapePitchingMatchups.js')) {
  main()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
