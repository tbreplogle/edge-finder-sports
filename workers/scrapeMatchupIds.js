
import puppeteer from 'puppeteer';
import { createScrapeReport } from './lib/supabaseClient.js';

// Enable debug mode when environment variable is set
const DEBUG = process.env.DEBUG === 'true';

/**
 * Scrapes MLB matchup IDs from Covers.com for today's games
 * @returns {Promise<string[]>} An array of unique matchup IDs
 */
export async function scrapeTodayMatchupIDs() {
  console.log('Starting to scrape today\'s MLB matchup IDs...');
  const url = 'https://www.covers.com/sports/mlb/matchups';
  
  try {
    // Launch browser with no-sandbox for CI environments
    const browser = await puppeteer.launch({ 
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new' // Use the new headless mode
    });
    
    // Create a new page and navigate to the URL
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    // Navigate to the matchups page
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    if (DEBUG) {
      await page.screenshot({ path: 'debug-matchups-page.png' });
    }
    
    // Wait for the matchup buttons to appear
    console.log('Waiting for matchup buttons to render...');
    await page.waitForSelector('a.matchup-btn-link', { timeout: 30000 });
    
    // Extract all matchup IDs
    console.log('Extracting matchup IDs...');
    const matchupIDs = await page.$$eval('a.matchup-btn-link', els =>
      els.map(el => {
        const m = el.href.match(/\/matchup\/(\d+)$/);
        return m ? m[1] : null;
      }).filter(id => id)
    );
    
    // Close browser
    await browser.close();
    
    // Remove duplicates and log results
    const uniqueMatchupIDs = [...new Set(matchupIDs)];
    console.log(`Found ${uniqueMatchupIDs.length} unique MLB matchup IDs:`, uniqueMatchupIDs);
    
    return uniqueMatchupIDs;
  } catch (error) {
    console.error('Error scraping today\'s MLB matchup IDs:', error.message);
    if (error.stack) console.error(error.stack);
    
    // Create error report
    createScrapeReport({
      success: false,
      error: `Failed to scrape MLB matchup IDs: ${error.message}`,
      timestamp: new Date().toISOString(),
      stats: { matchups: 0 }
    });
    
    // Return empty array on error
    return [];
  }
}

// Run if script is executed directly
if (import.meta.url.endsWith('scrapeMatchupIds.js')) {
  scrapeTodayMatchupIDs()
    .then(matchupIDs => {
      console.log('Today\'s MLB matchup IDs:', matchupIDs);
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error in MLB matchup ID scraper:', error);
      process.exit(1);
    });
}
