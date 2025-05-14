// workers/saveMatchupsToSupabase.js
import { scrapeAndSaveTodayMatchups } from './scrapeMatchupIds.js';

/**
 * Main function to scrape and save MLB matchups to Supabase
 */
async function main() {
  console.log('Starting MLB matchup scraper...');
  
  try {
    // Scrape and save matchups
    console.log('Scraping and saving today\'s MLB matchups...');
    const result = await scrapeAndSaveTodayMatchups();
    
    if (result.success) {
      console.log(✅ Successfully scraped and saved ${result.matchups.length} MLB matchups);
      return result.matchups;
    } else {
      console.error('❌ Failed to save MLB matchups:', result.error);
      return [];
    }
  } catch (error) {
    console.error('Error in MLB matchups scraper:', error);
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

