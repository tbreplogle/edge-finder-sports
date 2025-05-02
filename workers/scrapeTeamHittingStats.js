
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
    
    // Wait longer to ensure table is fully loaded with data
    await page.waitForTimeout(5000);
    
    // Extract rows from the table with the improved selector approach
    const rawRows = await page.evaluate(() => {
      const results = [];
      
      // Get all rows from the table body
      const rows = Array.from(document.querySelectorAll('table.bui-table tbody tr'));
      console.log(`Found ${rows.length} total rows in the table`);
      
      // Track teams processed for better debugging
      const teamNames = [];
      
      rows.forEach((row, index) => {
        try {
          // Check if this is a league header row (usually has fewer cells)
          const cells = Array.from(row.querySelectorAll('td'));
          
          if (cells.length < 18) {
            console.log(`Skipping row ${index} with only ${cells.length} cells (likely a header)`);
            return;
          }
          
          // Check if first cell has a team link (all team rows should have this)
          const firstCell = cells[0];
          const link = firstCell.querySelector('a');
          
          if (!link) {
            console.log(`Skipping row ${index} with no team link in first cell`);
            return;
          }
          
          const teamName = link.textContent.trim();
          teamNames.push(teamName);
          
          // Extract all the stats fields from the cells
          const teamData = {
            team_name: teamName,
            league: cells[1].textContent.trim(),
            games_played: parseInt(cells[2].textContent.trim(), 10) || 0,
            at_bats: parseInt(cells[3].textContent.trim(), 10) || 0,
            runs: parseInt(cells[4].textContent.trim(), 10) || 0,
            hits: parseInt(cells[5].textContent.trim(), 10) || 0,
            doubles: parseInt(cells[6].textContent.trim(), 10) || 0,
            triples: parseInt(cells[7].textContent.trim(), 10) || 0,
            home_runs: parseInt(cells[8].textContent.trim(), 10) || 0,
            rbi: parseInt(cells[9].textContent.trim(), 10) || 0,
            bb: parseInt(cells[10].textContent.trim(), 10) || 0,
            so: parseInt(cells[11].textContent.trim(), 10) || 0,
            sb: parseInt(cells[12].textContent.trim(), 10) || 0,
            cs: parseInt(cells[13].textContent.trim(), 10) || 0,
            avg: parseFloat(cells[14].textContent.trim()) || 0,
            obp: parseFloat(cells[15].textContent.trim()) || 0,
            slg: parseFloat(cells[16].textContent.trim()) || 0,
            ops: parseFloat(cells[17].textContent.trim()) || 0,
          };
          
          results.push(teamData);
        } catch (err) {
          console.log(`Error processing row ${index}: ${err.message}`);
        }
      });
      
      console.log(`Found ${teamNames.length} teams: ${teamNames.join(', ')}`);
      console.log(`Successfully extracted data for ${results.length} teams`);
      
      return results;
    });
    
    console.log(`Extracted ${rawRows.length} team rows from the page (should be 30)`);
    
    if (rawRows.length === 0) {
      console.error('❌ ERROR: No team rows were extracted! Table structure might have changed.');
      if (DEBUG) {
        console.log('Check the debug-html file for the current table structure.');
      }
    } else if (rawRows.length < 30) {
      console.warn(`⚠️ WARNING: Expected 30 teams but only found ${rawRows.length}`);
    } else {
      console.log(`✅ Successfully extracted all 30 MLB teams`);
    }
    
    // Close the browser
    await browser.close();
    
    // Add timeframe_days & game_date
    const gameDate = new Date().toISOString().split('T')[0];
    const stats = rawRows.map(r => ({
      ...r,
      timeframe_days: TIMEFRAME_DAYS,
      game_date: gameDate
    }));
    
    console.log(`Successfully scraped ${stats.length} team hitting stats for ${TIMEFRAME_DAYS}-day period`);
    
    if (DEBUG && stats.length > 0) {
      console.log('Sample data:', JSON.stringify(stats.slice(0, 2), null, 2));
    }
    
    // Write to repo root for GitHub Actions to find
    const outPath = path.resolve(process.cwd(), 'scrape-result.json');
    fs.writeFileSync(outPath, JSON.stringify(stats, null, 2));
    console.log(`✅ Wrote scrape-result.json with ${stats.length} rows to ${outPath}`);
    
    return stats;
  } catch (err) {
    console.error(`Error scraping MLB team hitting stats for ${TIMEFRAME_DAYS}-day period:`, err.message);
    if (err.stack) console.error(err.stack);
    
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
    
    // Scrape team stats (7-day only)
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
