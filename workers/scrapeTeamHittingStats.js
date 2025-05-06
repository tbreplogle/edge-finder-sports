import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';
import { scrapeTodayMatchupIDs } from './scrapeMatchupIds.js';

// Enable debug mode when environment variable is set
const DEBUG = process.env.DEBUG === 'true';

// Only 7 days needed
const TIMEFRAME_DAYS = 7;

/**
 * Maps a raw team name to its proper name, abbreviation, and ID
 * @param {string} teamName The raw team name from MLB stats
 * @returns {object} Object containing actual_team_name, team_abbr, and team_id
 */
function mapTeamInfo(teamName) {
  // Team ID mapping based on the image provided
  const teamMap = {
    'Seattle Mariners': { actual_team_name: 'Seattle Mariners', team_abbr: 'SEA', team_id: 1 },
    'Cleveland Guardians': { actual_team_name: 'Cleveland Guardians', team_abbr: 'CLE', team_id: 2 },
    'Pittsburgh Pirates': { actual_team_name: 'Pittsburgh Pirates', team_abbr: 'PIT', team_id: 3 },
    'Los Angeles Angels': { actual_team_name: 'Los Angeles Angels', team_abbr: 'LAA', team_id: 4 },
    'Toronto Blue Jays': { actual_team_name: 'Toronto Blue Jays', team_abbr: 'TOR', team_id: 5 },
    'Miami Marlins': { actual_team_name: 'Miami Marlins', team_abbr: 'MIA', team_id: 6 },
    'Oakland Athletics': { actual_team_name: 'Oakland Athletics', team_abbr: 'OAK', team_id: 7 },
    'New York Yankees': { actual_team_name: 'New York Yankees', team_abbr: 'NYY', team_id: 8 },
    'Tampa Bay Rays': { actual_team_name: 'Tampa Bay Rays', team_abbr: 'TBR', team_id: 9 },
    'Minnesota Twins': { actual_team_name: 'Minnesota Twins', team_abbr: 'MIN', team_id: 10 },
    'Kansas City Royals': { actual_team_name: 'Kansas City Royals', team_abbr: 'KCR', team_id: 11 },
    'San Francisco Giants': { actual_team_name: 'San Francisco Giants', team_abbr: 'SFG', team_id: 12 },
    'Arizona Diamondbacks': { actual_team_name: 'Arizona Diamondbacks', team_abbr: 'ARI', team_id: 13 },
    'Milwaukee Brewers': { actual_team_name: 'Milwaukee Brewers', team_abbr: 'MIL', team_id: 14 },
    'Chicago White Sox': { actual_team_name: 'Chicago White Sox', team_abbr: 'CWS', team_id: 15 },
    'Chicago Cubs': { actual_team_name: 'Chicago Cubs', team_abbr: 'CHC', team_id: 16 },
    'Atlanta Braves': { actual_team_name: 'Atlanta Braves', team_abbr: 'ATL', team_id: 17 },
    'San Diego Padres': { actual_team_name: 'San Diego Padres', team_abbr: 'SDP', team_id: 18 },
    'Houston Astros': { actual_team_name: 'Houston Astros', team_abbr: 'HOU', team_id: 19 },
    'New York Mets': { actual_team_name: 'New York Mets', team_abbr: 'NYM', team_id: 20 },
    'Los Angeles Dodgers': { actual_team_name: 'Los Angeles Dodgers', team_abbr: 'LAD', team_id: 21 },
    'Colorado Rockies': { actual_team_name: 'Colorado Rockies', team_abbr: 'COL', team_id: 22 },
    'Cincinnati Reds': { actual_team_name: 'Cincinnati Reds', team_abbr: 'CIN', team_id: 23 },
    'Washington Nationals': { actual_team_name: 'Washington Nationals', team_abbr: 'WSH', team_id: 24 },
    'Detroit Tigers': { actual_team_name: 'Detroit Tigers', team_abbr: 'DET', team_id: 25 },
    'Philadelphia Phillies': { actual_team_name: 'Philadelphia Phillies', team_abbr: 'PHI', team_id: 26 },
    'St. Louis Cardinals': { actual_team_name: 'St. Louis Cardinals', team_abbr: 'STL', team_id: 27 },
    'Texas Rangers': { actual_team_name: 'Texas Rangers', team_abbr: 'TEX', team_id: 28 },
    'Boston Red Sox': { actual_team_name: 'Boston Red Sox', team_abbr: 'BOS', team_id: 29 },
    'Baltimore Orioles': { actual_team_name: 'Baltimore Orioles', team_abbr: 'BAL', team_id: 30 }
  };

  // Special case for Athletics with duplicate name (case-insensitive)
  if (teamName.toUpperCase().includes('ATHLETICS') || teamName.includes('Oakland')) {
    return teamMap['Oakland Athletics'];
  }

  // Look for the team name in our mapping (handling variations with ILIKE logic)
  for (const [key, value] of Object.entries(teamMap)) {
    if (teamName.includes(key)) {
      return value;
    }
  }

  // Default return if no match found
  return { actual_team_name: null, team_abbr: null, team_id: null };
}

/**
 * Scrapes MLB team hitting statistics from the MLB stats website using Puppeteer
 * @returns {Promise<object[]>} An array of team hitting stats
 */
export async function scrapeTeamHittingStats() {
  try {
    // First fetch today's matchup IDs
    const todayMatchupIDs = await scrapeTodayMatchupIDs();
    console.log('Today\'s matchup IDs:', todayMatchupIDs);
    
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
    
    // Wait for the stats table to appear - specifically look for tbody rows
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
    
    // Extract rows from the table with updated selector to handle the new table structure
    const rawRows = await page.evaluate(() => {
      const results = [];
      
      // Get all rows from the table body
      const rows = Array.from(document.querySelectorAll('table.bui-table tbody tr'));
      console.log(`Found ${rows.length} total rows in the table body`);
      
      // Track teams processed for better debugging
      const teamNames = [];
      
      rows.forEach((row, index) => {
        try {
          // Select both th and td cells to handle the first column being a th
          const cells = Array.from(row.querySelectorAll('th, td'));
          
          // Skip rows that don't have enough cells for a team row
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
    
    // Add timeframe_days, game_date, and map team names to proper names and abbreviations
    const gameDate = new Date().toISOString().split('T')[0];
    const stats = rawRows.map(r => {
      // Get proper team name and abbreviation
      const teamInfo = mapTeamInfo(r.team_name);
      
      return {
        ...r,
        timeframe_days: TIMEFRAME_DAYS,
        game_date: gameDate,
        actual_team_name: teamInfo.actual_team_name,
        team_abbr: teamInfo.team_abbr,
        team_id: teamInfo.team_id
      };
    });
    
    console.log(`Successfully scraped ${stats.length} team hitting stats for ${TIMEFRAME_DAYS}-day period`);
    
    if (DEBUG && stats.length > 0) {
      console.log('Sample data with mapped team names:', JSON.stringify(stats.slice(0, 2), null, 2));
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
 * Runs the SQL migration and cleanup on the mlb_team_hitting_stats table
 * @returns {Promise<boolean>} Success status
 */
async function runTeamStatsMigration() {
  try {
    console.log('Running SQL migration and cleanup on mlb_team_hitting_stats table');
    
    const migrationSQL = `
    BEGIN;

    -- 1) Add team_id column if it doesn't exist
    ALTER TABLE mlb_team_hitting_stats
      ADD COLUMN IF NOT EXISTS actual_team_name TEXT,
      ADD COLUMN IF NOT EXISTS team_abbr CHAR(3),
      ADD COLUMN IF NOT EXISTS team_id INTEGER;

    -- 2) Update any records that might not have been properly mapped previously
    UPDATE mlb_team_hitting_stats
    SET
      actual_team_name = CASE
        WHEN team_name ILIKE '%Seattle Mariners%'       THEN 'Seattle Mariners'
        WHEN team_name ILIKE '%Cleveland Guardians%'    THEN 'Cleveland Guardians'
        WHEN team_name ILIKE '%Pittsburgh Pirates%'     THEN 'Pittsburgh Pirates'
        WHEN team_name ILIKE '%Los Angeles Angels%'     THEN 'Los Angeles Angels'
        WHEN team_name ILIKE '%Toronto Blue Jays%'      THEN 'Toronto Blue Jays'
        WHEN team_name ILIKE '%Miami Marlins%'          THEN 'Miami Marlins'
        WHEN team_name ILIKE '%Oakland Athletics%'      THEN 'Oakland Athletics'
        WHEN team_name ILIKE '%Athletics%'              THEN 'Oakland Athletics'
        WHEN team_name ILIKE '%New York Yankees%'       THEN 'New York Yankees'
        WHEN team_name ILIKE '%Tampa Bay Rays%'         THEN 'Tampa Bay Rays'
        WHEN team_name ILIKE '%Minnesota Twins%'        THEN 'Minnesota Twins'
        WHEN team_name ILIKE '%Kansas City Royals%'     THEN 'Kansas City Royals'
        WHEN team_name ILIKE '%San Francisco Giants%'   THEN 'San Francisco Giants'
        WHEN team_name ILIKE '%Arizona Diamondbacks%'   THEN 'Arizona Diamondbacks'
        WHEN team_name ILIKE '%Milwaukee Brewers%'      THEN 'Milwaukee Brewers'
        WHEN team_name ILIKE '%Chicago White Sox%'      THEN 'Chicago White Sox'
        WHEN team_name ILIKE '%Chicago Cubs%'           THEN 'Chicago Cubs'
        WHEN team_name ILIKE '%Atlanta Braves%'         THEN 'Atlanta Braves'
        WHEN team_name ILIKE '%San Diego Padres%'       THEN 'San Diego Padres'
        WHEN team_name ILIKE '%Houston Astros%'         THEN 'Houston Astros'
        WHEN team_name ILIKE '%New York Mets%'         THEN 'New York Mets'
        WHEN team_name ILIKE '%Los Angeles Dodgers%'    THEN 'Los Angeles Dodgers'
        WHEN team_name ILIKE '%Colorado Rockies%'       THEN 'Colorado Rockies'
        WHEN team_name ILIKE '%Cincinnati Reds%'        THEN 'Cincinnati Reds'
        WHEN team_name ILIKE '%Washington Nationals%'   THEN 'Washington Nationals'
        WHEN team_name ILIKE '%Detroit Tigers%'         THEN 'Detroit Tigers'
        WHEN team_name ILIKE '%Philadelphia Phillies%'  THEN 'Philadelphia Phillies'
        WHEN team_name ILIKE '%St. Louis Cardinals%'    THEN 'St. Louis Cardinals'
        WHEN team_name ILIKE '%Texas Rangers%'          THEN 'Texas Rangers'
        WHEN team_name ILIKE '%Boston Red Sox%'         THEN 'Boston Red Sox'
        WHEN team_name ILIKE '%Baltimore Orioles%'      THEN 'Baltimore Orioles'
        ELSE actual_team_name
      END,
      team_abbr = CASE
        WHEN team_name ILIKE '%Seattle Mariners%'       THEN 'SEA'
        WHEN team_name ILIKE '%Cleveland Guardians%'    THEN 'CLE'
        WHEN team_name ILIKE '%Pittsburgh Pirates%'     THEN 'PIT'
        WHEN team_name ILIKE '%Los Angeles Angels%'     THEN 'LAA'
        WHEN team_name ILIKE '%Toronto Blue Jays%'      THEN 'TOR'
        WHEN team_name ILIKE '%Miami Marlins%'          THEN 'MIA'
        WHEN team_name ILIKE '%Oakland Athletics%'      THEN 'OAK'
        WHEN team_name ILIKE '%Athletics%'              THEN 'OAK'
        WHEN team_name ILIKE '%New York Yankees%'       THEN 'NYY'
        WHEN team_name ILIKE '%Tampa Bay Rays%'         THEN 'TBR'
        WHEN team_name ILIKE '%Minnesota Twins%'        THEN 'MIN'
        WHEN team_name ILIKE '%Kansas City Royals%'     THEN 'KCR'
        WHEN team_name ILIKE '%San Francisco Giants%'   THEN 'SFG'
        WHEN team_name ILIKE '%Arizona Diamondbacks%'   THEN 'ARI'
        WHEN team_name ILIKE '%Milwaukee Brewers%'      THEN 'MIL'
        WHEN team_name ILIKE '%Chicago White Sox%'      THEN 'CWS'
        WHEN team_name ILIKE '%Chicago Cubs%'           THEN 'CHC'
        WHEN team_name ILIKE '%Atlanta Braves%'         THEN 'ATL'
        WHEN team_name ILIKE '%San Diego Padres%'       THEN 'SDP'
        WHEN team_name ILIKE '%Houston Astros%'         THEN 'HOU'
        WHEN team_name ILIKE '%New York Mets%'         THEN 'NYM'
        WHEN team_name ILIKE '%Los Angeles Dodgers%'    THEN 'LAD'
        WHEN team_name ILIKE '%Colorado Rockies%'       THEN 'COL'
        WHEN team_name ILIKE '%Cincinnati Reds%'        THEN 'CIN'
        WHEN team_name ILIKE '%Washington Nationals%'   THEN 'WSH'
        WHEN team_name ILIKE '%Detroit Tigers%'         THEN 'DET'
        WHEN team_name ILIKE '%Philadelphia Phillies%'  THEN 'PHI'
        WHEN team_name ILIKE '%St. Louis Cardinals%'    THEN 'STL'
        WHEN team_name ILIKE '%Texas Rangers%'          THEN 'TEX'
        WHEN team_name ILIKE '%Boston Red Sox%'         THEN 'BOS'
        WHEN team_name ILIKE '%Baltimore Orioles%'      THEN 'BAL'
        ELSE team_abbr
      END,
      team_id = CASE
        WHEN team_name ILIKE '%Seattle Mariners%'       THEN 1
        WHEN team_name ILIKE '%Cleveland Guardians%'    THEN 2
        WHEN team_name ILIKE '%Pittsburgh Pirates%'     THEN 3
        WHEN team_name ILIKE '%Los Angeles Angels%'     THEN 4
        WHEN team_name ILIKE '%Toronto Blue Jays%'      THEN 5
        WHEN team_name ILIKE '%Miami Marlins%'          THEN 6
        WHEN team_name ILIKE '%Oakland Athletics%'      THEN 7
        WHEN team_name ILIKE '%Athletics%'              THEN 7
        WHEN team_name ILIKE '%New York Yankees%'       THEN 8
        WHEN team_name ILIKE '%Tampa Bay Rays%'         THEN 9
        WHEN team_name ILIKE '%Minnesota Twins%'        THEN 10
        WHEN team_name ILIKE '%Kansas City Royals%'     THEN 11
        WHEN team_name ILIKE '%San Francisco Giants%'   THEN 12
        WHEN team_name ILIKE '%Arizona Diamondbacks%'   THEN 13
        WHEN team_name ILIKE '%Milwaukee Brewers%'      THEN 14
        WHEN team_name ILIKE '%Chicago White Sox%'      THEN 15
        WHEN team_name ILIKE '%Chicago Cubs%'           THEN 16
        WHEN team_name ILIKE '%Atlanta Braves%'         THEN 17
        WHEN team_name ILIKE '%San Diego Padres%'       THEN 18
        WHEN team_name ILIKE '%Houston Astros%'         THEN 19
        WHEN team_name ILIKE '%New York Mets%'         THEN 20
        WHEN team_name ILIKE '%Los Angeles Dodgers%'    THEN 21
        WHEN team_name ILIKE '%Colorado Rockies%'       THEN 22
        WHEN team_name ILIKE '%Cincinnati Reds%'        THEN 23
        WHEN team_name ILIKE '%Washington Nationals%'   THEN 24
        WHEN team_name ILIKE '%Detroit Tigers%'         THEN 25
        WHEN team_name ILIKE '%Philadelphia Phillies%'  THEN 26
        WHEN team_name ILIKE '%St. Louis Cardinals%'    THEN 27
        WHEN team_name ILIKE '%Texas Rangers%'          THEN 28
        WHEN team_name ILIKE '%Boston Red Sox%'         THEN 29
        WHEN team_name ILIKE '%Baltimore Orioles%'      THEN 30
        ELSE team_id
      END
    WHERE actual_team_name IS NULL OR team_abbr IS NULL OR team_id IS NULL;

    COMMIT;
    `;
    
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('Error running SQL migration:', error);
      return false;
    }
    
    console.log('✅ Successfully ran SQL migration and cleanup');
    return true;
  } catch (err) {
    console.error('Error running SQL migration:', err.message);
    if (err.stack) console.error(err.stack);
    return false;
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
    // Test Supabase connection before attempting operations
    const connectionSuccessful = await testConnection();
    
    if (!connectionSuccessful) {
      console.error('Failed to connect to Supabase - aborting data save');
      return false;
    }
    
    // Add team_id to each team stat based on team name lookup
    const enhancedTeamStats = teamStats.map(stat => {
      const teamInfo = mapTeamInfo(stat.team_name);
      return {
        ...stat,
        team_id: teamInfo.team_id,
        team_abbr: teamInfo.team_abbr || stat.team_abbr,
        actual_team_name: teamInfo.actual_team_name || stat.actual_team_name
      };
    });
    
    if (DEBUG) {
      console.log('Sample team data with team_id:', enhancedTeamStats[0]);
    }
    
    // Extract timeframe and game date for filtering
    const timeframe = enhancedTeamStats[0].timeframe_days;
    const gameDate = enhancedTeamStats[0].game_date;
    
    // Step 1: Delete existing records for the same timeframe and game date
    console.log(`Deleting existing records for timeframe: ${timeframe} days and date: ${gameDate}...`);
    const { error: deleteError } = await supabase
      .from('mlb_team_hitting_stats')
      .delete()
      .eq('timeframe_days', timeframe)
      .eq('game_date', gameDate);
      
    if (deleteError) {
      console.error('Error deleting existing team stats:', deleteError);
      return false;
    }
    
    console.log('✅ Successfully deleted existing records');
    
    // Step 2: Insert new records
    console.log('Inserting new team stats records...');
    // Log the first record we're trying to insert for debugging
    console.log('First record to insert:', JSON.stringify(enhancedTeamStats[0], null, 2));
    
    // Insert data (no need for upsert since we've already deleted existing records)
    const { data, error } = await supabase
      .from('mlb_team_hitting_stats')
      .insert(enhancedTeamStats);
    
    if (error) {
      console.error('Error saving team stats to Supabase:', error);
      
      if (DEBUG) {
        console.error('Error details:', JSON.stringify(error, null, 2));
        console.log('Sample of attempted insert:', JSON.stringify(enhancedTeamStats[0], null, 2));
      }
      
      // Always create a report even on error
      createScrapeReport({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        stats: { seven_day: enhancedTeamStats.length }
      });
      
      return false;
    } else {
      console.log('✅ Successfully saved team hitting stats to Supabase');
      
      // Run the SQL migration and cleanup after successful save
      const migrationSuccess = await runTeamStatsMigration();
      if (!migrationSuccess) {
        console.error('⚠️ Team stats saved, but migration/cleanup failed');
      }
      
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
    
    // First fetch today's matchup IDs
    const todayMatchupIDs = await scrapeTodayMatchupIDs();
    console.log('Today\'s matchup IDs:', todayMatchupIDs);
    
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
