
import { supabase, testConnection } from './lib/supabaseClient.js';
import { scrapeAndSaveTodayMatchups } from './scrapeMatchupIds.js';

/**
 * Main function to scrape and save MLB matchups to Supabase
 */
async function main() {
  console.log('Starting MLB matchup scraper...');
  
  try {
    // Test connection to Supabase
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Failed to connect to Supabase - aborting script');
      process.exit(1);
    }
    
    // Scrape and save matchups
    console.log('Scraping and saving today\'s MLB matchups...');
    const result = await scrapeAndSaveTodayMatchups(supabase);
    
    if (result.success) {
      console.log(`✅ Successfully scraped and saved ${result.matchups.length} MLB matchups`);
      return result.matchups;
    } else {
      console.error('❌ Failed to save MLB matchups');
      return [];
    }
  } catch (error) {
    console.error('Error in MLB matchups scraper:', error);
    process.exit(1);
  }
}

// Run if script is executed directly
if (import.meta.url === import.meta.main) {
  main().then(() => process.exit(0)).catch(() => process.exit(1));
}
