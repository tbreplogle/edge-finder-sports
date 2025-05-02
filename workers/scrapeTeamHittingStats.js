
import axios from 'axios';
import * as cheerio from 'cheerio';
import axiosRetry from 'axios-retry';
import fs from 'fs';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

// Enable debug mode when environment variable is set
const DEBUG = process.env.DEBUG === 'true';

// Configure axios with retry logic
axiosRetry(axios, {
  retries: 5, // Increased from 3 to 5
  retryDelay: retryCount => 3000 * retryCount, // Longer delays between retries
  retryCondition: error => 
    axiosRetry.isNetworkOrIdempotentRequestError(error) || 
    error.code === 'ERR_BAD_RESPONSE' || 
    error.code === 'ECONNABORTED' ||
    error.response?.status === 524 ||
    error.response?.status === 429, // Rate limiting
  onRetry: (retryCount, error) => {
    console.log(`Retry attempt #${retryCount} for MLB Stats`);
    console.log(`Reason: ${error.message}`);
  }
});

/**
 * Scrapes MLB team hitting statistics from the MLB stats website
 * @param {number} days - Number of days for the timeframe (-7 or -14)
 * @returns {Promise<object[]>} An array of team hitting stats
 */
export async function scrapeTeamHittingStats(days = -7) {
  try {
    const url = `https://www.mlb.com/stats/team/hitting?sortState=asc&timeframe=${days}`;
    console.log(`Fetching MLB team hitting stats from: ${url}`);
    
    if (DEBUG) {
      console.log(`SUPABASE_URL set: ${process.env.SUPABASE_URL ? 'Yes' : 'No'}`);
      console.log(`SUPABASE_SERVICE_ROLE_KEY set: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Yes' : 'No'}`);
    }
    
    const { data: html } = await axios.get(url, {
      timeout: 60000, // Increased timeout to 60 seconds
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    if (!html || typeof html !== 'string' || html.length < 1000) {
      throw new Error(`Invalid or empty HTML response: ${html?.substring(0, 100)}...`);
    }
    
    if (DEBUG) {
      console.log(`HTML content length: ${html.length}`);
      // Save a sample of the HTML for debugging
      const sampleHtml = html.substring(0, 500) + '... [truncated]';
      console.log(`HTML sample: ${sampleHtml}`);
      
      // Save full HTML for debugging
      fs.writeFileSync(`debug-html-${Math.abs(days)}-day.html`, html);
      console.log(`Full HTML saved to debug-html-${Math.abs(days)}-day.html`);
    }
    
    // Load HTML into cheerio
    const $ = cheerio.load(html);
    const stats = [];
    
    // Find the stats table - improved selectors to be more robust
    const tableRows = $('table tbody tr');
    
    if (tableRows.length === 0) {
      console.warn('Could not find stat table rows on the page');
      
      // Try alternative selectors if the main one fails
      const alternativeTableRows = $('.stats-table tbody tr, .team-stats tbody tr');
      
      if (alternativeTableRows.length > 0) {
        console.log(`Found ${alternativeTableRows.length} rows using alternative selector`);
        tableRows = alternativeTableRows;
      } else if (DEBUG) {
        // Save detailed selector information for debugging
        const selectors = [
          'table', 'tbody', 'tr', 
          '.stats-table', '.team-stats',
          'div.table-wrapper'
        ].map(sel => ({
          selector: sel,
          count: $(sel).length,
          html: $(sel).length > 0 ? $(sel).first().html()?.substring(0, 100) + '...' : 'not found'
        }));
        
        console.log('Detailed selector diagnostics:', JSON.stringify(selectors, null, 2));
        throw new Error('Could not locate team stats table in the HTML');
      }
    }
    
    console.log(`Found ${tableRows.length} team stats rows`);
    
    // Process each team row
    tableRows.each((index, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      
      // Skip if we don't have enough cells
      if (cells.length < 16) {
        console.warn(`Row ${index} has ${cells.length} cells, expected at least 16`);
        return;
      }
      
      // Extract the team name from the first cell
      const teamNameCell = $(cells[0]).find('a');
      const teamName = teamNameCell.text().trim();
      
      if (!teamName) {
        console.warn(`Could not extract team name from row ${index}`);
        return;
      }
      
      if (DEBUG) {
        console.log(`Processing team: ${teamName}`);
      }
      
      // Create stats object with careful parsing
      const teamStats = {
        team_name: teamName,
        timeframe_days: Math.abs(days),
        game_date: new Date().toISOString().slice(0, 10), // Today's date
        games_played: parseInt($(cells[1]).text().trim(), 10) || null,
        at_bats: parseInt($(cells[2]).text().trim(), 10) || null,
        runs: parseInt($(cells[3]).text().trim(), 10) || null,
        hits: parseInt($(cells[4]).text().trim(), 10) || null,
        doubles: parseInt($(cells[5]).text().trim(), 10) || null,
        triples: parseInt($(cells[6]).text().trim(), 10) || null,
        home_runs: parseInt($(cells[7]).text().trim(), 10) || null,
        rbi: parseInt($(cells[8]).text().trim(), 10) || null,
        bb: parseInt($(cells[9]).text().trim(), 10) || null,
        so: parseInt($(cells[10]).text().trim(), 10) || null,
        sb: parseInt($(cells[11]).text().trim(), 10) || null,
        cs: parseInt($(cells[12]).text().trim(), 10) || null,
        avg: parseFloat($(cells[13]).text().trim()) || null,
        obp: parseFloat($(cells[14]).text().trim()) || null,
        slg: parseFloat($(cells[15]).text().trim()) || null,
        ops: parseFloat($(cells[16]).text().trim()) || null
      };
      
      stats.push(teamStats);
    });
    
    if (stats.length === 0) {
      throw new Error('No team stats were extracted from the HTML');
    }
    
    console.log(`Successfully scraped ${stats.length} team hitting stats`);
    
    if (DEBUG) {
      console.log('Sample data:', JSON.stringify(stats.slice(0, 2), null, 2));
      fs.writeFileSync(`debug-stats-${Math.abs(days)}-day.json`, JSON.stringify(stats, null, 2));
    }
    
    return stats;
  } catch (err) {
    console.error('Error scraping MLB team hitting stats:', err.message);
    if (err.stack) console.error(err.stack);
    
    // Always create a result file even on error
    createScrapeReport({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
      stats: { seven_day: 0, fourteen_day: 0 }
    });
    
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
        
        // Try a single row insert to diagnose issues
        console.log('Attempting single row insert for diagnosis...');
        const singleInsertResult = await supabase
          .from('mlb_team_hitting_stats')
          .insert(teamStats[0]);
          
        console.log('Single row insert result:', JSON.stringify(singleInsertResult, null, 2));
      }
      
      // Always create a report even on error
      createScrapeReport({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        stats: { 
          seven_day: teamStats.filter(s => s.timeframe_days === 7).length,
          fourteen_day: teamStats.filter(s => s.timeframe_days === 14).length
        }
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
      stats: { 
        seven_day: teamStats.filter(s => s.timeframe_days === 7).length,
        fourteen_day: teamStats.filter(s => s.timeframe_days === 14).length
      }
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
    stats: { seven_day: 0, fourteen_day: 0 }, 
    timestamp: startTime.toISOString() 
  };
  
  try {
    // First check Supabase connection
    console.log('Verifying Supabase connection...');
    const connectionCheck = await testConnection();
    
    if (!connectionCheck) {
      throw new Error('Failed to connect to Supabase - aborting scrape job');
    }
    
    // Scrape 7-day stats
    console.log('Scraping 7-day team stats...');
    const sevenDayStats = await scrapeTeamHittingStats(-7);
    console.log(`Fetched ${sevenDayStats.length} 7-day team stats`);
    results.stats.seven_day = sevenDayStats.length;
    
    // Scrape 14-day stats
    console.log('Scraping 14-day team stats...');
    const fourteenDayStats = await scrapeTeamHittingStats(-14);
    console.log(`Fetched ${fourteenDayStats.length} 14-day team stats`);
    results.stats.fourteen_day = fourteenDayStats.length;
    
    // Save stats to Supabase only if we have data
    let saveSuccess = true;
    
    if (sevenDayStats.length > 0) {
      console.log('Saving 7-day stats to Supabase...');
      const sevenDaySuccess = await saveTeamStatsToSupabase(sevenDayStats);
      saveSuccess = saveSuccess && sevenDaySuccess;
    } else {
      console.warn('No 7-day stats to save to Supabase');
    }
    
    if (fourteenDayStats.length > 0) {
      console.log('Saving 14-day stats to Supabase...');
      const fourteenDaySuccess = await saveTeamStatsToSupabase(fourteenDayStats);
      saveSuccess = saveSuccess && fourteenDaySuccess;
    } else {
      console.warn('No 14-day stats to save to Supabase');
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
      sevenDayStats,
      fourteenDayStats,
      success: saveSuccess
    };
  } catch (error) {
    console.error('Failed to update MLB team hitting stats:', error);
    
    // Always write error result to file for GitHub Actions
    const errorResults = { 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString(),
      stats: { seven_day: 0, fourteen_day: 0 } 
    };
    createScrapeReport(errorResults);
    
    throw error;
  }
}

// Run if script is executed directly
if (import.meta.url === import.meta.main) {
  console.log('Running MLB team hitting stats scraper as standalone script');
  console.log('Current directory:', process.cwd());
  console.log('Node.js version:', process.version);
  console.log('Environment variables set:', Object.keys(process.env).filter(key => !key.includes('KEY')).join(', '));
  
  updateTeamHittingStats()
    .then(stats => {
      console.log('Script completed successfully!');
      console.log(JSON.stringify(stats, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('Error in updateTeamHittingStats:', error);
      process.exit(1);
    });
}
