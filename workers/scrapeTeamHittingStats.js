
import axios from 'axios';
import * as cheerio from 'cheerio';
import axiosRetry from 'axios-retry';
import fs from 'fs';
import { supabase, testConnection } from './lib/supabaseClient.js';

// Enable debug mode when environment variable is set
const DEBUG = process.env.DEBUG === 'true';

// Configure axios with retry logic
axiosRetry(axios, {
  retries: 3,
  retryDelay: retryCount => 2000 * retryCount,
  retryCondition: error => 
    axiosRetry.isNetworkOrIdempotentRequestError(error) || 
    error.code === 'ERR_BAD_RESPONSE' || 
    error.code === 'ECONNABORTED' ||
    error.response?.status === 524,
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
  const url = `https://www.mlb.com/stats/team/hitting?sortState=asc&timeframe=${days}`;
  console.log(`Fetching MLB team hitting stats from: ${url}`);
  
  try {
    // Debug logging for environment variables (sanitized)
    if (DEBUG) {
      console.log(`SUPABASE_URL set: ${process.env.SUPABASE_URL ? 'Yes' : 'No'}`);
      console.log(`SUPABASE_SERVICE_ROLE_KEY set: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Yes' : 'No'}`);
    }
    
    const { data: html } = await axios.get(url, {
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
      }
    });
    
    if (DEBUG) {
      console.log(`HTML content length: ${html.length}`);
      // Save a sample of the HTML for debugging
      const sampleHtml = html.substring(0, 500) + '... [truncated]';
      console.log(`HTML sample: ${sampleHtml}`);
      
      // Save full HTML for debugging
      fs.writeFileSync(`debug-html-${Math.abs(days)}-day.txt`, html);
    }
    
    // Load HTML into cheerio
    const $ = cheerio.load(html);
    const stats = [];
    
    // Find the stats table
    const tableRows = $('table tbody tr');
    
    if (tableRows.length === 0) {
      console.warn('Could not find stat table rows on the page');
      
      if (DEBUG) {
        // Save selectors for debugging
        const selectors = ['table', 'tbody', 'tr'].map(sel => ({
          selector: sel,
          count: $(sel).length
        }));
        console.log('Selector counts:', JSON.stringify(selectors, null, 2));
      }
      
      return [];
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
      
      if (DEBUG) {
        console.log(`Processing team: ${teamName}`);
      }
      
      // Create stats object
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
    
    console.log(`Successfully scraped ${stats.length} team hitting stats`);
    
    if (DEBUG) {
      console.log('Sample data:', JSON.stringify(stats.slice(0, 2), null, 2));
    }
    
    return stats;
  } catch (err) {
    console.error('Error scraping MLB team hitting stats:', err.message);
    if (err.stack) console.error(err.stack);
    return [];
  }
}

/**
 * Saves team hitting stats to Supabase
 * @param {object[]} teamStats - Array of team hitting stats
 * @returns {Promise<boolean>} Success status
 */
async function saveTeamStatsToSupabase(teamStats) {
  if (teamStats.length === 0) {
    console.log('No team stats to save');
    return false;
  }
  
  console.log(`Saving ${teamStats.length} team hitting stats to Supabase`);
  
  try {
    // Test Supabase connection
    await testConnection();
    
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
      
      return false;
    } else {
      console.log('Successfully saved team hitting stats to Supabase');
      return true;
    }
  } catch (err) {
    console.error('Exception saving team stats to Supabase:', err.message);
    if (err.stack) console.error(err.stack);
    return false;
  }
}

/**
 * Main function to scrape and save MLB team hitting stats
 */
export async function updateTeamHittingStats() {
  console.log('⏳ Starting MLB team hitting stats update...');
  const results = { success: false, stats: { seven_day: 0, fourteen_day: 0 } };
  
  try {
    // Scrape 7-day stats
    const sevenDayStats = await scrapeTeamHittingStats(-7);
    console.log(`Fetched ${sevenDayStats.length} 7-day team stats`);
    results.stats.seven_day = sevenDayStats.length;
    
    // Scrape 14-day stats
    const fourteenDayStats = await scrapeTeamHittingStats(-14);
    console.log(`Fetched ${fourteenDayStats.length} 14-day team stats`);
    results.stats.fourteen_day = fourteenDayStats.length;
    
    // Save stats to Supabase
    let saveSuccess = true;
    
    if (sevenDayStats.length > 0) {
      const sevenDaySuccess = await saveTeamStatsToSupabase(sevenDayStats);
      saveSuccess = saveSuccess && sevenDaySuccess;
    }
    
    if (fourteenDayStats.length > 0) {
      const fourteenDaySuccess = await saveTeamStatsToSupabase(fourteenDayStats);
      saveSuccess = saveSuccess && fourteenDaySuccess;
    }
    
    results.success = saveSuccess;
    
    console.log('✅ MLB team hitting stats update completed successfully');
    
    // Write results to file for GitHub Actions
    fs.writeFileSync('scrape-result.json', JSON.stringify(results, null, 2));
    
    return {
      sevenDayStats,
      fourteenDayStats,
      success: saveSuccess
    };
  } catch (error) {
    console.error('Failed to update MLB team hitting stats:', error);
    
    // Write error result to file for GitHub Actions
    const errorResults = { 
      success: false, 
      error: error.message,
      stats: { seven_day: 0, fourteen_day: 0 } 
    };
    fs.writeFileSync('scrape-result.json', JSON.stringify(errorResults, null, 2));
    
    throw error;
  }
}

// Run if script is executed directly
if (import.meta.url === import.meta.main) {
  updateTeamHittingStats()
    .then(stats => {
      console.log(JSON.stringify(stats, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('Error in updateTeamHittingStats:', error);
      process.exit(1);
    });
}
