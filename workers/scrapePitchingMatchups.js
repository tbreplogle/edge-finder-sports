
// workers/scrapePitchingMatchups.js
import puppeteer from 'puppeteer';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

const DEBUG = process.env.DEBUG === 'true';

/** scrape one matchup's pitcher names + "Last 5 Avg." row for away & home */
async function scrapePitchingFor(matchup_id) {
  const url = `https://www.covers.com/sport/baseball/mlb/matchup/${matchup_id}`;
  const browser = await puppeteer.launch({
    args: ['--no-sandbox','--disable-setuid-sandbox'],
    headless: 'new',
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  // wait for pitchers to appear
  await page.waitForSelector('a.anchor-with-border', { timeout: 30000 });
  await page.waitForTimeout(500);             // let React finish

  // 1) grab the two starter names (away first, home second)
  const [away_pitcher_name, home_pitcher_name] = await page.$$eval(
    'a.anchor-with-border',
    els => els
      .map(el => el.innerText.trim())
      .filter(txt => /\(\w\)$/.test(txt))
      .slice(0, 2)
  );

  // 2) grab all "Last 5 Avg." rows (one per pitcher) and parse
  const statsRows = await page.$$eval('tr', trs =>
    trs
      .filter(tr => tr.querySelector('td b')?.innerText === 'Last 5 Avg.')
      .map(row => Array.from(row.querySelectorAll('td b')).map(b => b.innerText))
  );

  await browser.close();

  if (statsRows.length < 2) {
    throw new Error(`Couldn't find two "Last 5 Avg." rows for ${matchup_id}`);
  }

  const parseRow = bs => ({
    ip:         parseFloat(bs[3]),
    h:          parseFloat(bs[4]),
    r:          parseFloat(bs[5]),
    er:         parseFloat(bs[6]),
    so:         parseFloat(bs[7]),
    bb:         parseFloat(bs[8]),
    hr:         parseFloat(bs[9]),
    pit:        parseFloat(bs[10]),
    p_per_ip:   parseFloat(bs[11]),
    gb_fb:      parseFloat(bs[12]),
  });

  const awayStats = parseRow(statsRows[0]);
  const homeStats = parseRow(statsRows[1]);

  return {
    matchup_id,
    away_pitcher_name,
    ...Object.fromEntries(
      Object.entries(awayStats).map(([k,v]) => [`away_${k}`, v])
    ),
    home_pitcher_name,
    ...Object.fromEntries(
      Object.entries(homeStats).map(([k,v]) => [`home_${k}`, v])
    )
  };
}

export async function scrapeAndSavePitchingMatchups() {
  console.log('→ Starting pitching-matchups scraper…');
  if (!(await testConnection())) {
    console.error('❌ Supabase connection failed');
    process.exit(1);
  }

  // pull today's matchup_ids from mlb_matchups
  const today = new Date().toISOString().slice(0, 10);
  const { data: rows, error: selErr } = await supabase
    .from('mlb_matchups')
    .select('matchup_id')
    .eq('game_date', today);

  if (selErr) {
    console.error('❌ Couldn't load today's matchups:', selErr);
    process.exit(1);
  }

  const results = [];
  for (const { matchup_id } of rows) {
    try {
      const rec = await scrapePitchingFor(matchup_id);
      console.log(`→ [${matchup_id}] scraped`);
      results.push(rec);
    } catch (e) {
      console.error(`⚠️  [${matchup_id}] failed:`, e.message);
    }
  }

  if (results.length === 0) {
    console.warn('⚠️  No pitching stats to save');
    createScrapeReport({
      success: false,
      error: 'No pitching stats scraped',
      timestamp: new Date().toISOString(),
      stats: { count: 0 }
    });
    return;
  }

  // upsert into pitching_matchups
  const { data, error: upErr } = await supabase
    .from('pitching_matchups')
    .upsert(results, { onConflict: ['matchup_id'] })
    .select();

  if (upErr) {
    console.error('❌ Upsert error:', upErr);
    createScrapeReport({
      success: false,
      error: upErr.message,
      timestamp: new Date().toISOString(),
      stats: { count: 0 }
    });
    return;
  }

  console.log(`✅ Saved ${data.length} pitching‐matchup rows`);
  createScrapeReport({
    success: true,
    timestamp: new Date().toISOString(),
    stats: { count: data.length },
    pitching: data
  });
}

// if invoked directly…
if (import.meta.url.endsWith('scrapePitchingMatchups.js')) {
  scrapeAndSavePitchingMatchups()
    .then(()=>process.exit(0))
    .catch(()=>process.exit(1));
}
