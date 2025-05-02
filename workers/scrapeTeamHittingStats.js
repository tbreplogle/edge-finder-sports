
import axios from 'axios';
import * as cheerio from 'cheerio';
import axiosRetry from 'axios-retry';
import { supabase } from './lib/supabaseClient.js';

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
    const { data: html } = await axios.get(url, {
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
      }
    });
    
    // Load HTML into cheerio
    const $ = cheerio.load(html);
    const stats = [];
    
    // Find the stats table
    // The table is typically in a section with class containing 'StatsTable'
    const tableRows = $('table tbody tr');
    
    if (tableRows.length === 0) {
      console.warn('Could not find stat table rows on the page');
      return [];
    }
    
    console.log(`Found ${tableRows.length} team stats rows`);
    
    // Process each team row
    tableRows.each((index, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      
      // Skip if we don't have enough cells
      if (cells.length < 16) {
        return;
      }
      
      // Extract the team name from the first cell
      const teamNameCell = $(cells[0]).find('a');
      const teamName = teamNameCell.text().trim();
      
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
    return stats;
  } catch (err) {
    console.error('Error scraping MLB team hitting stats:', err.message);
    return [];
  }
}

/**
 * Saves team hitting stats to Supabase
 * @param {object[]} teamStats - Array of team hitting stats
 */
async function saveTeamStatsToSupabase(teamStats) {
  if (teamStats.length === 0) {
    console.log('No team stats to save');
    return;
  }
  
  console.log(`Saving ${teamStats.length} team hitting stats to Supabase`);
  
  try {
    const { data, error } = await supabase
      .from('mlb_team_hitting_stats')
      .upsert(teamStats, {
        onConflict: 'team_name,timeframe_days,game_date',
        ignoreDuplicates: false
      });
      
    if (error) {
      console.error('Error saving team stats to Supabase:', error);
    } else {
      console.log('Successfully saved team hitting stats to Supabase');
    }
  } catch (err) {
    console.error('Exception saving team stats to Supabase:', err.message);
  }
}

/**
 * Main function to scrape and save MLB team hitting stats
 */
export async function updateTeamHittingStats() {
  console.log('⏳ Starting MLB team hitting stats update...');
  
  try {
    // Scrape 7-day stats
    const sevenDayStats = await scrapeTeamHittingStats(-7);
    console.log(`Fetched ${sevenDayStats.length} 7-day team stats`);
    
    // Scrape 14-day stats
    const fourteenDayStats = await scrapeTeamHittingStats(-14);
    console.log(`Fetched ${fourteenDayStats.length} 14-day team stats`);
    
    // Save stats to Supabase
    if (sevenDayStats.length > 0) {
      await saveTeamStatsToSupabase(sevenDayStats);
    }
    
    if (fourteenDayStats.length > 0) {
      await saveTeamStatsToSupabase(fourteenDayStats);
    }
    
    console.log('✅ MLB team hitting stats update completed successfully');
    
    // Return the stats as JSON for debugging if run directly
    return {
      sevenDayStats,
      fourteenDayStats
    };
  } catch (error) {
    console.error('Failed to update MLB team hitting stats:', error);
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
