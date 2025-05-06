
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
  let browser, page;
  
  try {
    // Launch browser with no-sandbox for CI environments
    browser = await puppeteer.launch({ 
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new' // Use the new headless mode
    });
    
    // Create a new page and navigate to the URL
    page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    // Navigate to the matchups page
    console.log(`→ Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    if (DEBUG) {
      await page.screenshot({ path: 'debug-matchups-page.png' });
    }
    
    // Wait for the matchup buttons to appear
    console.log('Waiting for matchup buttons to render...');
    await page.waitForSelector('a.matchup-btn-link', { timeout: 30000 });
    
    // Grab everything in one pass - starting with the matchup links
    console.log('Extracting matchup details from links...');
    const matchups = await page.$$eval('a.matchup-btn-link', anchors =>
      anchors.map(a => {
        const m = a.href.match(/\/matchup\/(\d+)$/);
        const matchup_id = m && m[1];
        
        // Climb up to the nearest game box wrapper
        const gameBox = a.closest('.article-content.p-3');
        if (!gameBox) return null;
        
        const codes = Array.from(gameBox.querySelectorAll('span.text-nowrap'))
          .map(el => el.innerText.trim());
            
        const dateText = gameBox.querySelector('strong.preGame-status')?.innerText.trim();
        const dt = dateText
          ? new Date(`${dateText} ${new Date().getFullYear()}`)
          : null;
        const game_date = dt ? dt.toISOString().slice(0,10) : null;
        
        return matchup_id ? {
          game_id: matchup_id,
          matchup_id,
          away_team: codes[0] ?? null,
          home_team: codes[1] ?? null,
          game_date
        } : null;
      })
      .filter(x => x)
    );
    
    console.log(`→ Extracted ${matchups.length} matchups`);
    
    if (DEBUG) {
      console.log('Matchup data:', JSON.stringify(matchups, null, 2));
    }
    
    // Close browser
    await page.close();
    await browser.close();
    
    // Save to Supabase if we have matchups
    if (matchups.length > 0) {
      console.log(`Saving ${matchups.length} matchups to Supabase...`);
      const { data, error } = await supabase
        .from('mlb_matchups')
        .upsert(matchups, { 
          onConflict: ['matchup_id'],
          ignoreDuplicates: false 
        })
        .select();
        
      if (error) {
        console.error('❌ Supabase upsert error:', error);
        createScrapeReport({
          success: false,
          error: `Failed to insert matchups: ${error.message}`,
          timestamp: new Date().toISOString(),
          stats: { matchups: 0 }
        });
        return { success: false, matchups: [] };
      }
      
      console.log(`✅ Successfully saved ${data.length} matchups to Supabase`);
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
  } finally {
    // Make sure browser is closed in all cases
    try {
      if (page && !page.isClosed()) await page.close();
      if (browser) await browser.close();
    } catch (err) {
      console.error('Error closing browser:', err.message);
    }
  }
}

// REMOVED the direct execution at the bottom of this file
// This file will now only export functions, not run them directly
