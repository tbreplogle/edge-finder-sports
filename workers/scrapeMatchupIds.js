
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

/**
 * Scrapes detailed MLB matchup data from Covers.com and saves to Supabase
 * @param {Object} supabase - The Supabase client instance
 * @returns {Promise<Object>} The result of the operation
 */
export async function scrapeAndSaveTodayMatchups(supabase) {
  console.log('Starting to scrape and save today\'s MLB matchups...');
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
    
    // Get all game containers
    console.log('Finding game containers...');
    const gameContainers = await page.$$('.article-content.p-3');
    console.log(`Found ${gameContainers.length} game containers`);
    
    // Extract data from each container
    console.log('Extracting matchup details...');
    const matchups = [];
    
    for (let i = 0; i < gameContainers.length; i++) {
      const game = gameContainers[i];
      
      try {
        // Get matchup ID from link
        const href = await game.$eval('a.matchup-btn-link', a => a.href);
        const matchupIdMatch = href.match(/\/matchup\/(\d+)$/);
        if (!matchupIdMatch) continue;
        
        const matchup_id = matchupIdMatch[1];
        const game_id = matchup_id; // Using matchup_id as game_id for now
        
        // Get team names
        const teamAnchors = await game.$$('a.gamebox-team-anchor span.text-nowrap');
        if (teamAnchors.length < 2) continue;
        
        const away_team = await teamAnchors[0].evaluate(el => el.innerText.trim());
        const home_team = await teamAnchors[1].evaluate(el => el.innerText.trim());
        
        // Get game date
        const dateText = await game.$eval('strong.preGame-status', el => el.innerText.trim());
        // e.g. "Wednesday, May 7"
        const dt = new Date(`${dateText} ${new Date().getFullYear()}`);
        const game_date = dt.toISOString().slice(0, 10);
        
        matchups.push({
          game_id,
          matchup_id,
          home_team,
          away_team,
          game_date
        });
        
        console.log(`Processed game ${i+1}/${gameContainers.length}: ${away_team} @ ${home_team} on ${game_date} (ID: ${matchup_id})`);
      } catch (err) {
        console.error(`Error processing game container ${i+1}:`, err.message);
      }
    }
    
    // Close browser
    await browser.close();
    
    // Save to Supabase if we have matchups
    if (matchups.length > 0) {
      console.log(`Saving ${matchups.length} matchups to Supabase...`);
      const { data, error } = await supabase
        .from('mlb_matchups')
        .upsert(matchups, { 
          onConflict: 'matchup_id',
          ignoreDuplicates: false 
        })
        .select();
        
      if (error) {
        console.error('Failed inserting matchups:', error);
        createScrapeReport({
          success: false,
          error: `Failed to insert matchups: ${error.message}`,
          timestamp: new Date().toISOString(),
          stats: { matchups: 0 }
        });
        return { success: false, matchups: [] };
      }
      
      console.log(`Successfully saved ${data.length} matchups to Supabase`);
      createScrapeReport({
        success: true,
        timestamp: new Date().toISOString(),
        stats: { matchups: data.length },
        matchups: data
      });
      
      return { success: true, matchups: data };
    } else {
      console.warn('No matchups found to save');
      createScrapeReport({
        success: false,
        error: 'No matchups found to save',
        timestamp: new Date().toISOString(),
        stats: { matchups: 0 }
      });
      return { success: false, matchups: [] };
    }
  } catch (error) {
    console.error('Error scraping and saving matchups:', error.message);
    if (error.stack) console.error(error.stack);
    
    createScrapeReport({
      success: false,
      error: `Failed to scrape and save matchups: ${error.message}`,
      timestamp: new Date().toISOString(),
      stats: { matchups: 0 }
    });
    
    return { success: false, matchups: [] };
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
