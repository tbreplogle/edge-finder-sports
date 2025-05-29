//getMlbMatchupIds.js
import { scrapeTodayMatchupIDs } from './scrapeMatchupIds.js';

/**
 * Simple script to run the MLB matchup ID scraper
 */
async function main() {
  try {
    console.log('Fetching today\'s MLB matchup IDs...');
    const matchupIDs = await scrapeTodayMatchupIDs();
    
    console.log('------------------------');
    console.log(`Found ${matchupIDs.length} matchup IDs:`);
    console.log(matchupIDs.join(', '));
    console.log('------------------------');
    
    return matchupIDs;
  } catch (error) {
    console.error('Error fetching MLB matchup IDs:', error);
    return [];
  }
}

// Run if script is executed directly
if (import.meta.url === import.meta.main) {
  main().then(() => process.exit(0)).catch(() => process.exit(1));
}
