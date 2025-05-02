import axios from 'axios';
import * as cheerio from 'cheerio';
import axiosRetry from 'axios-retry';
import fs from 'fs';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

// Enable debug mode when environment variable is set
const DEBUG = process.env.DEBUG === 'true';

// Configure axios with retry logic
axiosRetry(axios, {
  retries: 5,
  retryDelay: retryCount => 3000 * retryCount,
  retryCondition: error => 
    axiosRetry.isNetworkOrIdempotentRequestError(error) || 
    error.code === 'ERR_BAD_RESPONSE' || 
    error.code === 'ECONNABORTED' ||
    error.response?.status === 524 ||
    error.response?.status === 429,
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
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'max-age=0',
        'Referer': 'https://www.mlb.com/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    if (!html || typeof html !== 'string' || html.length < 1000) {
      throw new Error(`Invalid or empty HTML response: ${html?.substring(0, 100)}...`);
    }
    
    if (DEBUG) {
      console.log(`HTML content length: ${html.length}`);
      // Save full HTML for debugging
      fs.writeFileSync(`debug-html-${Math.abs(days)}-day.html`, html);
      console.log(`Full HTML saved to debug-html-${Math.abs(days)}-day.html`);
    }
    
    // Load HTML into cheerio
    const $ = cheerio.load(html);
    const stats = [];
    
    // First attempt: Try to parse data directly from the table
    // MLB.com now uses a standard table structure in some views
    const tableSelector = 'table.bui-table';
    const table = $(tableSelector);
    
    if (table.length > 0) {
      console.log('Found stats table using primary selector');
      
      // Get table headers to map columns correctly
      const headers = [];
      table.find('thead th').each((i, el) => {
        headers.push($(el).text().trim().toLowerCase());
      });
      
      console.log('Found headers:', headers);
      
      // Create a mapping from header position to our data structure
      const headerMap = {};
      headers.forEach((header, index) => {
        switch(header) {
          case 'team': headerMap.team_name = index; break;
          case 'g': headerMap.games_played = index; break;
          case 'ab': headerMap.at_bats = index; break;
          case 'r': headerMap.runs = index; break;
          case 'h': headerMap.hits = index; break;
          case '2b': headerMap.doubles = index; break;
          case '3b': headerMap.triples = index; break;
          case 'hr': headerMap.home_runs = index; break;
          case 'rbi': headerMap.rbi = index; break;
          case 'bb': headerMap.bb = index; break;
          case 'so': headerMap.so = index; break;
          case 'sb': headerMap.sb = index; break;
          case 'cs': headerMap.cs = index; break;
          case 'avg': headerMap.avg = index; break;
          case 'obp': headerMap.obp = index; break;
          case 'slg': headerMap.slg = index; break;
          case 'ops': headerMap.ops = index; break;
        }
      });
      
      // Process each team row
      table.find('tbody tr').each((index, row) => {
        const cells = $(row).find('td');
        
        // Extract team name - it might be in a link or a plain cell
        let teamName = '';
        const teamCell = $(cells[headerMap.team_name]);
        const teamLink = teamCell.find('a');
        
        if (teamLink.length > 0) {
          teamName = teamLink.text().trim();
        } else {
          teamName = teamCell.text().trim();
        }
        
        // Skip if no team name was found
        if (!teamName) {
          return;
        }
        
        // Create the team stats object with parsed values
        const teamStats = {
          team_name: teamName,
          timeframe_days: Math.abs(days),
          game_date: new Date().toISOString().slice(0, 10),
          games_played: headerMap.games_played !== undefined ? parseInt($(cells[headerMap.games_played]).text().trim(), 10) || null : null,
          at_bats: headerMap.at_bats !== undefined ? parseInt($(cells[headerMap.at_bats]).text().trim(), 10) || null : null,
          runs: headerMap.runs !== undefined ? parseInt($(cells[headerMap.runs]).text().trim(), 10) || null : null,
          hits: headerMap.hits !== undefined ? parseInt($(cells[headerMap.hits]).text().trim(), 10) || null : null,
          doubles: headerMap.doubles !== undefined ? parseInt($(cells[headerMap.doubles]).text().trim(), 10) || null : null,
          triples: headerMap.triples !== undefined ? parseInt($(cells[headerMap.triples]).text().trim(), 10) || null : null,
          home_runs: headerMap.home_runs !== undefined ? parseInt($(cells[headerMap.home_runs]).text().trim(), 10) || null : null,
          rbi: headerMap.rbi !== undefined ? parseInt($(cells[headerMap.rbi]).text().trim(), 10) || null : null,
          bb: headerMap.bb !== undefined ? parseInt($(cells[headerMap.bb]).text().trim(), 10) || null : null,
          so: headerMap.so !== undefined ? parseInt($(cells[headerMap.so]).text().trim(), 10) || null : null,
          sb: headerMap.sb !== undefined ? parseInt($(cells[headerMap.sb]).text().trim(), 10) || null : null,
          cs: headerMap.cs !== undefined ? parseInt($(cells[headerMap.cs]).text().trim(), 10) || null : null,
          avg: headerMap.avg !== undefined ? parseFloat($(cells[headerMap.avg]).text().trim()) || null : null,
          obp: headerMap.obp !== undefined ? parseFloat($(cells[headerMap.obp]).text().trim()) || null : null,
          slg: headerMap.slg !== undefined ? parseFloat($(cells[headerMap.slg]).text().trim()) || null : null,
          ops: headerMap.ops !== undefined ? parseFloat($(cells[headerMap.ops]).text().trim()) || null : null
        };
        
        stats.push(teamStats);
        console.log(`Processed team: ${teamName}`);
      });
    } 
    // If we couldn't find the table with the primary selector, try alternative selectors
    else {
      console.log('Primary table selector failed, trying alternatives...');
      
      // Try various alternative selectors that might contain the table
      const alternativeSelectors = [
        '.stats-table',
        '#stats-table-container table',
        '.team-stats-table',
        '.bui-table',
        'table'
      ];
      
      let foundTable = false;
      
      for (const selector of alternativeSelectors) {
        const tableRows = $(selector).find('tbody tr');
        if (tableRows.length > 0) {
          console.log(`Found table rows using alternative selector: ${selector}`);
          foundTable = true;
          
          // First determine the column indices by examining the headers
          const headers = [];
          $(selector).find('thead th').each((i, el) => {
            headers.push($(el).text().trim().toLowerCase());
          });
          
          console.log('Found headers:', headers);
          
          // Create a mapping from header position to our data structure
          const headerMap = {};
          headers.forEach((header, index) => {
            switch(header) {
              case 'team': headerMap.team_name = index; break;
              case 'g': headerMap.games_played = index; break;
              case 'ab': headerMap.at_bats = index; break;
              case 'r': headerMap.runs = index; break;
              case 'h': headerMap.hits = index; break;
              case '2b': headerMap.doubles = index; break;
              case '3b': headerMap.triples = index; break;
              case 'hr': headerMap.home_runs = index; break;
              case 'rbi': headerMap.rbi = index; break;
              case 'bb': headerMap.bb = index; break;
              case 'so': headerMap.so = index; break;
              case 'sb': headerMap.sb = index; break;
              case 'cs': headerMap.cs = index; break;
              case 'avg': headerMap.avg = index; break;
              case 'obp': headerMap.obp = index; break;
              case 'slg': headerMap.slg = index; break;
              case 'ops': headerMap.ops = index; break;
            }
          });
          
          // Now process each row
          tableRows.each((index, row) => {
            const cells = $(row).find('td');
            
            if (cells.length < 3) {
              return; // Skip rows with too few cells
            }
            
            // Extract team name
            let teamName = '';
            if (headerMap.team_name !== undefined) {
              const teamCell = $(cells[headerMap.team_name]);
              const teamLink = teamCell.find('a');
              
              if (teamLink.length > 0) {
                teamName = teamLink.text().trim();
              } else {
                teamName = teamCell.text().trim();
              }
            } else {
              // If we couldn't determine the header mapping, try the first cell
              const teamCell = $(cells[0]);
              const teamLink = teamCell.find('a');
              
              if (teamLink.length > 0) {
                teamName = teamLink.text().trim();
              } else {
                teamName = teamCell.text().trim();
              }
            }
            
            // Skip if no team name was found
            if (!teamName) {
              return;
            }
            
            // Create the team stats object with parsed values
            const teamStats = {
              team_name: teamName,
              timeframe_days: Math.abs(days),
              game_date: new Date().toISOString().slice(0, 10),
              games_played: headerMap.games_played !== undefined ? parseInt($(cells[headerMap.games_played]).text().trim(), 10) || null : null,
              at_bats: headerMap.at_bats !== undefined ? parseInt($(cells[headerMap.at_bats]).text().trim(), 10) || null : null,
              runs: headerMap.runs !== undefined ? parseInt($(cells[headerMap.runs]).text().trim(), 10) || null : null,
              hits: headerMap.hits !== undefined ? parseInt($(cells[headerMap.hits]).text().trim(), 10) || null : null,
              doubles: headerMap.doubles !== undefined ? parseInt($(cells[headerMap.doubles]).text().trim(), 10) || null : null,
              triples: headerMap.triples !== undefined ? parseInt($(cells[headerMap.triples]).text().trim(), 10) || null : null,
              home_runs: headerMap.home_runs !== undefined ? parseInt($(cells[headerMap.home_runs]).text().trim(), 10) || null : null,
              rbi: headerMap.rbi !== undefined ? parseInt($(cells[headerMap.rbi]).text().trim(), 10) || null : null,
              bb: headerMap.bb !== undefined ? parseInt($(cells[headerMap.bb]).text().trim(), 10) || null : null,
              so: headerMap.so !== undefined ? parseInt($(cells[headerMap.so]).text().trim(), 10) || null : null,
              sb: headerMap.sb !== undefined ? parseInt($(cells[headerMap.sb]).text().trim(), 10) || null : null,
              cs: headerMap.cs !== undefined ? parseInt($(cells[headerMap.cs]).text().trim(), 10) || null : null,
              avg: headerMap.avg !== undefined ? parseFloat($(cells[headerMap.avg]).text().trim()) || null : null,
              obp: headerMap.obp !== undefined ? parseFloat($(cells[headerMap.obp]).text().trim()) || null : null,
              slg: headerMap.slg !== undefined ? parseFloat($(cells[headerMap.slg]).text().trim()) || null : null,
              ops: headerMap.ops !== undefined ? parseFloat($(cells[headerMap.ops]).text().trim()) || null : null
            };
            
            stats.push(teamStats);
            console.log(`Processed team: ${teamName}`);
          });
          
          break; // Exit the loop once we've found a usable table
        }
      }
      
      // If we still couldn't find a table, try a more direct approach with any table on the page
      if (!foundTable) {
        console.log('Alternative selectors failed, trying direct table parsing...');
        
        // Find all tables on the page and examine each one
        const tables = $('table');
        console.log(`Found ${tables.length} tables on the page`);
        
        // Try each table until we find one with team data
        for (let i = 0; i < tables.length; i++) {
          const currentTable = $(tables[i]);
          const rows = currentTable.find('tbody tr');
          
          if (rows.length > 0) {
            console.log(`Examining table ${i} with ${rows.length} rows`);
            
            // Try to identify if this is a stats table by checking for stat-like headers
            const headers = [];
            currentTable.find('thead th, thead td, tr:first-child th, tr:first-child td').each((i, el) => {
              headers.push($(el).text().trim().toLowerCase());
            });
            
            // Check if this looks like a stats table
            const statsHeaders = ['team', 'g', 'ab', 'r', 'h', 'hr', 'avg', 'obp'];
            const matchCount = statsHeaders.filter(header => headers.includes(header)).length;
            
            if (matchCount >= 3) { // If we match at least 3 expected headers
              console.log(`Table ${i} appears to be a stats table with headers: ${headers.join(', ')}`);
              
              // Create a mapping from header position to our data structure
              const headerMap = {};
              headers.forEach((header, index) => {
                switch(header) {
                  case 'team': headerMap.team_name = index; break;
                  case 'g': headerMap.games_played = index; break;
                  case 'ab': headerMap.at_bats = index; break;
                  case 'r': headerMap.runs = index; break;
                  case 'h': headerMap.hits = index; break;
                  case '2b': headerMap.doubles = index; break;
                  case '3b': headerMap.triples = index; break;
                  case 'hr': headerMap.home_runs = index; break;
                  case 'rbi': headerMap.rbi = index; break;
                  case 'bb': headerMap.bb = index; break;
                  case 'so': headerMap.so = index; break;
                  case 'sb': headerMap.sb = index; break;
                  case 'cs': headerMap.cs = index; break;
                  case 'avg': headerMap.avg = index; break;
                  case 'obp': headerMap.obp = index; break;
                  case 'slg': headerMap.slg = index; break;
                  case 'ops': headerMap.ops = index; break;
                }
              });
              
              // If we have a reasonable mapping, process the rows
              if (Object.keys(headerMap).length >= 5) {
                rows.each((index, row) => {
                  const cells = $(row).find('td');
                  
                  if (cells.length < 3) {
                    return; // Skip rows with too few cells
                  }
                  
                  // Extract team name
                  let teamName = '';
                  if (headerMap.team_name !== undefined) {
                    const teamCell = $(cells[headerMap.team_name]);
                    const teamLink = teamCell.find('a');
                    
                    if (teamLink.length > 0) {
                      teamName = teamLink.text().trim();
                    } else {
                      teamName = teamCell.text().trim();
                    }
                  } else {
                    // If we couldn't determine the header mapping, try the first cell
                    const teamCell = $(cells[0]);
                    const teamLink = teamCell.find('a');
                    
                    if (teamLink.length > 0) {
                      teamName = teamLink.text().trim();
                    } else {
                      teamName = teamCell.text().trim();
                    }
                  }
                  
                  // Skip if no team name was found
                  if (!teamName) {
                    return;
                  }
                  
                  // Create the team stats object with parsed values
                  const teamStats = {
                    team_name: teamName,
                    timeframe_days: Math.abs(days),
                    game_date: new Date().toISOString().slice(0, 10),
                    games_played: headerMap.games_played !== undefined ? parseInt($(cells[headerMap.games_played]).text().trim(), 10) || null : null,
                    at_bats: headerMap.at_bats !== undefined ? parseInt($(cells[headerMap.at_bats]).text().trim(), 10) || null : null,
                    runs: headerMap.runs !== undefined ? parseInt($(cells[headerMap.runs]).text().trim(), 10) || null : null,
                    hits: headerMap.hits !== undefined ? parseInt($(cells[headerMap.hits]).text().trim(), 10) || null : null,
                    doubles: headerMap.doubles !== undefined ? parseInt($(cells[headerMap.doubles]).text().trim(), 10) || null : null,
                    triples: headerMap.triples !== undefined ? parseInt($(cells[headerMap.triples]).text().trim(), 10) || null : null,
                    home_runs: headerMap.home_runs !== undefined ? parseInt($(cells[headerMap.home_runs]).text().trim(), 10) || null : null,
                    rbi: headerMap.rbi !== undefined ? parseInt($(cells[headerMap.rbi]).text().trim(), 10) || null : null,
                    bb: headerMap.bb !== undefined ? parseInt($(cells[headerMap.bb]).text().trim(), 10) || null : null,
                    so: headerMap.so !== undefined ? parseInt($(cells[headerMap.so]).text().trim(), 10) || null : null,
                    sb: headerMap.sb !== undefined ? parseInt($(cells[headerMap.sb]).text().trim(), 10) || null : null,
                    cs: headerMap.cs !== undefined ? parseInt($(cells[headerMap.cs]).text().trim(), 10) || null : null,
                    avg: headerMap.avg !== undefined ? parseFloat($(cells[headerMap.avg]).text().trim()) || null : null,
                    obp: headerMap.obp !== undefined ? parseFloat($(cells[headerMap.obp]).text().trim()) || null : null,
                    slg: headerMap.slg !== undefined ? parseFloat($(cells[headerMap.slg]).text().trim()) || null : null,
                    ops: headerMap.ops !== undefined ? parseFloat($(cells[headerMap.ops]).text().trim()) || null : null
                  };
                  
                  stats.push(teamStats);
                  console.log(`Processed team: ${teamName}`);
                });
                
                if (stats.length > 0) {
                  console.log(`Extracted ${stats.length} team stats from table ${i}`);
                  break; // Exit the loop if we've found usable data
                }
              }
            }
          }
        }
      }
    }
    
    // If we still don't have stats, try direct page analysis for client-rendered content
    if (stats.length === 0) {
      console.log('Table parsing methods failed, attempting to extract from page structure...');
      
      // Look for any patterns that might indicate team names and stats
      // This is a last resort fallback method
      const teamNames = [];
      const teamStats = {};
      
      // Look for team names first
      $('a').each((i, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        
        // MLB team links often have patterns like /team/123/name
        if (href && href.includes('/team/') && text.length > 0) {
          if (!teamNames.includes(text)) {
            teamNames.push(text);
            teamStats[text] = { team_name: text };
          }
        }
      });
      
      console.log(`Found ${teamNames.length} potential team names from links`);
      
      // If we still don't have team names, create fallback data
      if (teamNames.length === 0) {
        console.warn('Could not extract any team data, using fallback MLB teams');
        
        // All MLB team abbreviations
        const mlbTeams = [
          'ARI', 'ATL', 'BAL', 'BOS', 'CHC', 'CWS', 'CIN', 'CLE', 'COL', 'DET', 
          'HOU', 'KC', 'LAA', 'LAD', 'MIA', 'MIL', 'MIN', 'NYM', 'NYY', 'OAK', 
          'PHI', 'PIT', 'SD', 'SF', 'SEA', 'STL', 'TB', 'TEX', 'TOR', 'WSH'
        ];
        
        // Create a placeholder entry for each team
        mlbTeams.forEach(team => {
          stats.push({
            team_name: team,
            timeframe_days: Math.abs(days),
            game_date: new Date().toISOString().slice(0, 10),
            games_played: null,
            at_bats: null,
            runs: null,
            hits: null,
            doubles: null,
            triples: null,
            home_runs: null,
            rbi: null,
            bb: null,
            so: null,
            sb: null,
            cs: null,
            avg: null,
            obp: null,
            slg: null,
            ops: null
          });
        });
      }
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
      // Create a report file even when connection fails
      createScrapeReport({
        success: false,
        error: 'Failed to connect to Supabase - check your credentials',
        timestamp: startTime.toISOString(),
        stats: { seven_day: 0, fourteen_day: 0 }
      });
      
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
    
    // Don't throw the error, let the process complete but with an error status
    return {
      sevenDayStats: [],
      fourteenDayStats: [],
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
    .then(stats => {
      console.log('Script completed successfully!');
      console.log(JSON.stringify(stats, null, 2));
      process.exit(stats.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Error in updateTeamHittingStats:', error);
      
      // Create a scrape report here as a last resort
      createScrapeReport({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        stats: { seven_day: 0, fourteen_day: 0 }
      });
      
      process.exit(1);
    });
}
