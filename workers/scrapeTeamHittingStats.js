
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

// Enable debug mode when environment variable is set
const DEBUG = process.env.DEBUG === 'true';

// Only 7 days needed
const TIMEFRAME_DAYS = 7;

/**
 * Scrapes MLB team hitting statistics from the MLB stats website using Puppeteer
 * @returns {Promise<object[]>} An array of team hitting stats
 */
export async function scrapeTeamHittingStats() {
  try {
    const url = `https://www.mlb.com/stats/team/hitting?sortState=asc&timeframe=-${TIMEFRAME_DAYS}`;
    console.log(`🕵️‍♂️ Launching browser to scrape: ${url}`);
    
    if (DEBUG) {
      console.log(`SUPABASE_URL set: ${process.env.SUPABASE_URL ? 'Yes' : 'No'}`);
      console.log(`SUPABASE_SERVICE_ROLE_KEY set: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Yes' : 'No'}`);
    }
    
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
    
    // Navigate to the page and wait for content to load
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for the stats table to appear
    await page.waitForSelector('table.bui-table tbody tr', { timeout: 30000 });
    
    if (DEBUG) {
      // Save screenshot and HTML for debugging
      await page.screenshot({ path: `debug-screenshot-${TIMEFRAME_DAYS}-day.png` });
      const html = await page.content();
      fs.writeFileSync(`debug-html-${TIMEFRAME_DAYS}-day.html`, html);
      console.log(`Debug screenshot and HTML saved for ${TIMEFRAME_DAYS}-day stats`);
    }
    
    // Extract rows from the table
    const rawRows = await page.$$eval('table.bui-table tbody tr', (trs) => {
      return trs.map(tr => {
        const cells = Array.from(tr.querySelectorAll('td'));
        
        // Skip rows with insufficient data
        if (cells.length < 13) return null;
        
        // Extract team name properly from the first cell
        // First try to get the team name from the tooltip aria-label
        let teamNameElement = cells[0].querySelector('span[aria-label]');
        let teamName = teamNameElement ? teamNameElement.getAttribute('aria-label') : null;
        
        // If not found in aria-label, try to get the text directly
        if (!teamName) {
          teamName = cells[0].textContent.trim();
          
          // Filter out "American League" or "National League" entries
          if (teamName === 'American League' || teamName === 'National League' || 
              teamName === 'AL' || teamName === 'NL') {
            return null;
          }
        }
        
        // Helper function to convert null/NaN values to 0
        const parseIntSafe = (value) => {
          const parsed = parseInt(value.replace(/,/g, ''), 10);
          return isNaN(parsed) ? 0 : parsed;
        };
        
        // Helper function to convert null/NaN values to 0.0 for floats
        const parseFloatSafe = (value) => {
          const parsed = parseFloat(value);
          return isNaN(parsed) ? 0.0 : parsed;
        };
        
        return {
          team_name: teamName,
          games_played: parseIntSafe(cells[1].textContent.trim()),
          at_bats: parseIntSafe(cells[2].textContent.trim()),
          runs: parseIntSafe(cells[3].textContent.trim()),
          hits: parseIntSafe(cells[4].textContent.trim()),
          doubles: parseIntSafe(cells[5].textContent.trim()),
          triples: parseIntSafe(cells[6].textContent.trim()),
          home_runs: parseIntSafe(cells[7].textContent.trim()),
          rbi: parseIntSafe(cells[8].textContent.trim()),
          bb: parseIntSafe(cells[9].textContent.trim()),
          so: parseIntSafe(cells[10].textContent.trim()),
          sb: parseIntSafe(cells[11].textContent.trim()),
          cs: parseIntSafe(cells[12].textContent.trim()),
          avg: parseFloatSafe(cells[13].textContent.trim()),
          obp: parseFloatSafe(cells[14].textContent.trim()),
          slg: parseFloatSafe(cells[15].textContent.trim()),
          ops: parseFloatSafe(cells[16].textContent.trim())
        };
      }).filter(item => item !== null); // Remove null entries
    });
    
    // Close the browser
    await browser.close();
    
    // Deduplicate by team_name
    const uniqueRows = rawRows.filter((row, idx, arr) =>
      arr.findIndex(r => r.team_name === row.team_name) === idx
    );
    
    // Add timeframe_days & game_date
    const gameDate = new Date().toISOString().split('T')[0];
    const stats = uniqueRows.map(r => ({
      ...r,
      timeframe_days: TIMEFRAME_DAYS,
      game_date: gameDate
    }));
    
    console.log(`Successfully scraped ${stats.length} team hitting stats for ${TIMEFRAME_DAYS}-day period`);
    
    if (DEBUG) {
      console.log('Sample data:', JSON.stringify(stats.slice(0, 2), null, 2));
    }
    
    // Write to repo root for GitHub Actions to find
    const outPath = path.resolve(process.cwd(), 'scrape-result.json');
    fs.writeFileSync(outPath, JSON.stringify(stats, null, 2));
    console.log(`✅ Wrote scrape-result.json with ${stats.length} rows to ${outPath}`);
    
    // If no stats were found, return an empty array
    if (stats.length === 0) {
      console.warn('No team stats data could be extracted from the page');
      return [];
    }
    
    return stats;
  } catch (err) {
    console.error(`Error scraping MLB team hitting stats for ${TIMEFRAME_DAYS}-day period:`, err.message);
    if (err.stack) console.error(err.stack);
    
    // Create a report indicating the error
    createScrapeReport({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
      stats: { seven_day: 0 }
    });
    
    // Return empty array instead of fallback data
    return [];
  }
}

/**
 * Saves team hitting stats to Supabase
 * @param {object[]} teamStats - Array of team hitting stats
 * @returns {Promise<boolean>} Success status
 */
async function saveTeamStatsToSupabase(teamStats) {
  if (!teamStats || teamStats.length === 0) {
    console.log('No team stats to save');
    return false;
  }
  
  console.log(`Saving ${teamStats.length} team hitting stats to Supabase`);
  
  try {
    // Test Supabase connection before attempting insert
    const connectionSuccessful = await testConnection();
    
    if (!connectionSuccessful) {
      console.error('Failed to connect to Supabase - aborting data save');
      return false;
    }
    
    // Log the first record we're trying to insert for debugging
    console.log('First record to insert:', JSON.stringify(teamStats[0], null, 2));
    
    // Insert data using upsert with onConflict for handling duplicates
    const { data, error } = await supabase
      .from('mlb_team_hitting_stats')
      .upsert(teamStats, {
        onConflict: 'team_name,timeframe_days,game_date',
        ignoreDuplicates: false
      });
    
    if (error) {
      console.error('Error saving team stats to Supabase:', error);
      
      if (DEBUG) {
        console.error('Error details:', JSON.stringify(error, null, 2));
        console.log('Sample of attempted insert:', JSON.stringify(teamStats[0], null, 2));
      }
      
      // Always create a report even on error
      createScrapeReport({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        stats: { seven_day: teamStats.length }
      });
      
      return false;
    } else {
      console.log('✅ Successfully saved team hitting stats to Supabase');
      return true;
    }
  } catch (err) {
    console.error('Exception saving team stats to Supabase:', err.message);
    if (err.stack) console.error(err.stack);
    
    // Always create a report even on exception
    createScrapeReport({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
      stats: { seven_day: teamStats.length }
    });
    
    return false;
  }
}

/**
 * Main function to scrape and save MLB team hitting stats
 */
export async function updateTeamHittingStats() {
  console.log('⏳ Starting MLB team hitting stats update...');
  const startTime = new Date();
  const results = { 
    success: false, 
    stats: { seven_day: 0 }, 
    timestamp: startTime.toISOString() 
  };
  
  try {
    // First check Supabase connection
    console.log('Verifying Supabase connection...');
    const connectionCheck = await testConnection();
    
    if (!connectionCheck) {
      // Create a report file even when connection fails
      createScrapeReport({
        success: false,
        error: 'Failed to connect to Supabase - check your credentials',
        timestamp: startTime.toISOString(),
        stats: { seven_day: 0 }
      });
      
      throw new Error('Failed to connect to Supabase - aborting scrape job');
    }
    
    // Scrape team stats (7-day only now)
    console.log(`Scraping ${TIMEFRAME_DAYS}-day team stats...`);
    const teamStats = await scrapeTeamHittingStats();
    console.log(`Fetched ${teamStats.length} team stats`);
    results.stats.seven_day = teamStats.length;
    
    // Save stats to Supabase only if we have data
    let saveSuccess = true;
    
    if (teamStats.length > 0) {
      console.log('Saving stats to Supabase...');
      saveSuccess = await saveTeamStatsToSupabase(teamStats);
    } else {
      console.warn('No stats to save to Supabase');
      saveSuccess = false;
    }
    
    results.success = saveSuccess;
    
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    
    if (saveSuccess) {
      console.log(`✅ MLB team hitting stats update completed successfully in ${duration}s`);
    } else {
      console.log(`⚠️ MLB team hitting stats update completed with issues in ${duration}s`);
    }
    
    // Always write results to file for GitHub Actions
    createScrapeReport(results);
    
    return {
      stats: teamStats,
      success: saveSuccess
    };
  } catch (error) {
    console.error('Failed to update MLB team hitting stats:', error);
    
    // Always write error result to file for GitHub Actions
    const errorResults = { 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString(),
      stats: { seven_day: 0 } 
    };
    createScrapeReport(errorResults);
    
    // Don't throw the error, let the process complete but with an error status
    return {
      stats: [],
      success: false
    };
  }
}

// Run if script is executed directly
if (import.meta.url.endsWith('scrapeTeamHittingStats.js')) {
  console.log('Running MLB team hitting stats scraper as standalone script');
  console.log('Current directory:', process.cwd());
  console.log('Node.js version:', process.version);
  console.log('Environment variables set:', Object.keys(process.env).filter(key => !key.includes('KEY')).join(', '));
  
  updateTeamHittingStats()
    .then(result => {
      console.log('Script completed successfully!');
      console.log(`Scraped ${result.stats.length} team stats records.`);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Error in updateTeamHittingStats:', error);
      
      // Create a scrape report here as a last resort
      createScrapeReport({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        stats: { seven_day: 0 }
      });
      
      process.exit(1);
    });
}
