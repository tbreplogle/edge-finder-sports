/* workers/saveMatchupsToSupabase.js
   Launches the scrapeMatchupIds routine and stores results */

import { scrapeAndSaveTodayMatchups } from './scrapeMatchupIds.js';

async function main() {
  console.log('Starting MLB matchup scraper…');

  try {
    console.log("Scraping and saving today's MLB matchups…");
    const result = await scrapeAndSaveTodayMatchups();

    if (result.success) {
      console.log(
        `✅ Successfully scraped and saved ${result.matchups.length} MLB matchups`
      );
    } else {
      console.error('❌ Failed to save MLB matchups:', result.error);
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('❌ Error in MLB matchup scraper:', err);
    process.exitCode = 1;
  }
}

main()
  .then(() => process.exit())
  .catch(() => process.exit(1));
