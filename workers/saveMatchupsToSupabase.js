// workers/saveMatchupsToSupabase.js
import * as matchupScraper from './scrapeMatchupIds.js';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

/**
 * Choose the scrape function that actually exists in scrapeMatchupIds.js
 *  - Prefer scrapeTodayMatchups
 *  - Fallback to scrapeAndSaveTodayMatchups
 */
const scrapeFn =
  matchupScraper.scrapeTodayMatchups ??
  matchupScraper.scrapeAndSaveTodayMatchups;

if (typeof scrapeFn !== 'function') {
  console.error(
    '❌ Neither scrapeTodayMatchups nor scrapeAndSaveTodayMatchups was exported ' +
      'from scrapeMatchupIds.js – cannot continue.'
  );
  process.exit(1);
}

async function main() {
  console.log('⏳ Starting MLB matchup scraper…');

  // 1) Ensure we can talk to Supabase
  if (!(await testConnection())) {
    console.error('❌ Supabase connection failed, aborting.');
    process.exit(1);
  }

  try {
    // 2) Scrape today’s matchups
    console.log('🕵️‍♂️  Scraping today’s MLB matchups…');
    const rawMatchups = await scrapeFn();

    // 3) Always assign a game_date (default to today‑CT if missing)
    const todayCT = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Chicago',
    }); // YYYY‑MM‑DD
    const matchups = rawMatchups.map(m => ({
      ...m,
      game_date: m.game_date || todayCT,
    }));

    console.log(`→ Upserting ${matchups.length} records to Supabase…`);
    const { data, error } = await supabase
      .from('mlb_matchups')
      .upsert(matchups, { onConflict: ['matchup_id'] })
      .select();

    if (error) throw error;

    console.log(`✅ Upserted ${data.length} rows.`);
    await createScrapeReport({
      success: true,
      timestamp: new Date().toISOString(),
      stats: { matchups: data.length },
    });
    process.exit(0);
  } catch (err) {
    console.error('❌ Error in scraper:', err.message);
    await createScrapeReport({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
      stats: { matchups: 0 },
    });
    process.exit(1);
  }
}

main();
