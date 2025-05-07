// workers/saveMatchupsToSupabase.js
import { scrapeTodayMatchups } from './scrapeMatchupIds.js';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

async function main() {
  console.log('⏳ Starting MLB matchup scraper…');

  // 1) Ensure we can talk to Supabase
  if (!(await testConnection())) {
    console.error('❌ Supabase connection failed, aborting.');
    process.exit(1);
  }

  try {
    // 2) Scrape today’s matchups
    console.log("🕵️‍♂️  Scraping today’s MLB matchups…");
    const rawMatchups = await scrapeTodayMatchups();

    // 3) Default any null dates to today’s ISO date
    const today = new Date().toISOString().split('T')[0];
    const matchups = rawMatchups.map(m => ({
      ...m,
      game_date: m.game_date || today
    }));

    console.log(`→ Upserting ${matchups.length} records to Supabase…`);
    const { data, error } = await supabase
      .from('mlb_matchups')
      .upsert(matchups, { onConflict: ['matchup_id'] })
      .select();

    if (error) {
      throw error;
    }

    console.log(`✅ Upserted ${data.length} rows.`);
    createScrapeReport({
      success: true,
      timestamp: new Date().toISOString(),
      stats: { matchups: data.length }
    });
    process.exit(0);

  } catch (err) {
    console.error('❌ Error in scraper:', err.message);
    createScrapeReport({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
      stats: { matchups: 0 }
    });
    process.exit(1);
  }
}

main();
