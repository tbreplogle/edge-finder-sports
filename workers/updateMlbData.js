
import { supabase } from './lib/supabaseClient.js';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { parse } from 'csv-parse/sync';

// Configure axios with retry logic with improved settings
axiosRetry(axios, {
  retries: 3,
  retryDelay: retryCount => 3000 * retryCount,
  retryCondition: error => 
    axiosRetry.isNetworkOrIdempotentRequestError(error) || 
    error.code === 'ERR_BAD_RESPONSE' || 
    error.code === 'ECONNABORTED' ||
    error.response?.status === 524,
  onRetry: (retryCount, error) => {
    console.log(`Retry attempt #${retryCount} for ${error.config.url}`);
    console.log(`Reason: ${error.message}`);
  }
});

// ✅ Dates
const today = new Date();
const start = new Date(today);
start.setDate(today.getDate() - 14);
// Create mid-point date (7 days ago)
const mid = new Date(today);
mid.setDate(today.getDate() - 7);

const startDate = start.toISOString().slice(0, 10);
const midDate = mid.toISOString().slice(0, 10);
const endDate = today.toISOString().slice(0, 10);

// ✅ API URLs
const MLB_API = 'https://statsapi.mlb.com/api/v1';
const SAVANT_CSV = 'https://baseballsavant.mlb.com/statcast_search/csv';

// 1. Pull team stats from Baseball Savant
async function fetchTeamStats() {
  try {
    console.log('Fetching team stats from Baseball Savant...');
    
    // Construct Baseball Savant URLs for team stats (split into two 7-day windows)
    const firstWeekUrl = `${SAVANT_CSV}?all=true&player_type=team&hfGT=R%7C&hfDateGt=${startDate}&hfDateLt=${midDate}`;
    const secondWeekUrl = `${SAVANT_CSV}?all=true&player_type=team&hfGT=R%7C&hfDateGt=${midDate}&hfDateLt=${endDate}`;
    
    console.log(`First week URL: ${firstWeekUrl}`);
    console.log(`Second week URL: ${secondWeekUrl}`);
    
    // Download CSVs with retry mechanism and longer timeout
    const firstWeekResponse = await axios.get(firstWeekUrl, {
      timeout: 60000 // 60 second timeout
    });
    
    const secondWeekResponse = await axios.get(secondWeekUrl, {
      timeout: 60000 // 60 second timeout
    });
    
    // Parse CSVs
    const firstWeekRows = parse(firstWeekResponse.data, { columns: true });
    const secondWeekRows = parse(secondWeekResponse.data, { columns: true });
    
    // Combine results
    const rows = [...firstWeekRows, ...secondWeekRows];
    console.log(`Parsed ${rows.length} rows of team data (${firstWeekRows.length} from first week, ${secondWeekRows.length} from second week)`);
    
    // Process team stats
    const teamMap = {};
    for (const row of rows) {
      const team = row.team;
      
      if (!teamMap[team]) {
        teamMap[team] = {
          team_abbr: team,
          hr: 0,
          hra: 0,
          ba: 0,
          games: 0
        };
      }
      
      // For batting stats
      if (row.player_type === 'batter') {
        teamMap[team].hr += parseInt(row.home_runs || 0);
        teamMap[team].ba = parseFloat(row.ba || 0);
      } 
      // For pitching stats
      else if (row.player_type === 'pitcher') {
        teamMap[team].hra += parseInt(row.home_runs || 0);
      }
      
      teamMap[team].games += 1;
    }
    
    // Convert map to array for database insertion
    return Object.values(teamMap);
  } catch (error) {
    console.error('Error fetching team stats from Baseball Savant:', error.message);
    throw error;
  }
}

// 2. Pull matchups
async function fetchMatchups() {
  const { data } = await axios.get(`${MLB_API}/schedule`, {
    params: {
      sportId: 1,
      date: endDate,
      hydrate: 'probablePitcher'
    },
    timeout: 30000 // 30 second timeout
  });

  const matchups = [];
  for (const d of data.dates) {
    for (const g of d.games) {
      const home_pitcher_id = g.teams.home?.probablePitcher?.id?.toString();
      const away_pitcher_id = g.teams.away?.probablePitcher?.id?.toString();
      
      matchups.push({
        game_id: g.gamePk.toString(),
        game_date: endDate,
        home_team: g.teams.home.team.abbreviation,
        away_team: g.teams.away.team.abbreviation,
        home_pitcher_id,
        away_pitcher_id
      });
    }
  }
  return matchups;
}

// 3. Pull probable pitcher stats (Savant CSV)
async function fetchPitchers(matchups) {
  const pitchers = [];

  for (const m of matchups) {
    for (const side of ['home', 'away']) {
      const team = m[`${side}_team`];
      const pid = m[`${side}_pitcher_id`]; // Now properly extracted from matchups
      if (!pid) continue;

      // Split pitcher date range into two weeks as well
      const firstWeekUrl = `${SAVANT_CSV}?player_type=pitcher&player_id=${pid}&game_date_gt=${startDate}&game_date_lt=${midDate}&all=true`;
      const secondWeekUrl = `${SAVANT_CSV}?player_type=pitcher&player_id=${pid}&game_date_gt=${midDate}&game_date_lt=${endDate}&all=true`;
      
      try {
        let rows = [];
        
        // First week data
        try {
          const { data: firstWeekCsv } = await axios.get(firstWeekUrl, {
            timeout: 30000 // 30 second timeout
          });
          const firstWeekRows = parse(firstWeekCsv, { columns: true });
          rows = [...rows, ...firstWeekRows];
          console.log(`Fetched first week data for pitcher ${pid}: ${firstWeekRows.length} rows`);
        } catch (err) {
          console.warn(`Error fetching first week data for pitcher ${pid}:`, err.message);
        }
        
        // Second week data
        try {
          const { data: secondWeekCsv } = await axios.get(secondWeekUrl, {
            timeout: 30000 // 30 second timeout
          });
          const secondWeekRows = parse(secondWeekCsv, { columns: true });
          rows = [...rows, ...secondWeekRows];
          console.log(`Fetched second week data for pitcher ${pid}: ${secondWeekRows.length} rows`);
        } catch (err) {
          console.warn(`Error fetching second week data for pitcher ${pid}:`, err.message);
        }
        
        if (rows.length === 0) {
          console.warn(`No data found for pitcher ${pid}`);
          continue;
        }
        
        const ip = rows.reduce((s, r) => s + +r.ip, 0);
        const er = rows.reduce((s, r) => s + +r.er, 0);
        const h = rows.reduce((s, r) => s + +r.h, 0);
        const bb = rows.reduce((s, r) => s + +r.bb, 0);
        const era = ip ? (er * 9) / ip : 0;
        const whip = ip ? (h + bb) / ip : 0;
        const eraPlus = era ? (100 * 4.00) / era : 100;

        pitchers.push({
          game_id: m.game_id,
          team_abbr: team,
          era_plus: Math.round(eraPlus),
          whip: +whip.toFixed(2),
          side
        });
      } catch (err) {
        console.error(`Pitcher error for ${pid}:`, err.message);
      }
    }
  }

  return pitchers;
}

// 4. Save all to Supabase
async function saveToSupabase(table, rows, conflictKey) {
  if (rows.length === 0) {
    console.log(`No data to save for ${table}`);
    return;
  }
  
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: conflictKey });
  
  if (error) {
    console.error(`Error saving to ${table}:`, error.message);
  } else {
    console.log(`Successfully saved ${rows.length} rows to ${table}`);
  }
}

async function run() {
  console.log('⏳ Pulling MLB data...');
  
  try {
    const teams = await fetchTeamStats();
    console.log(`Fetched ${teams.length} team stats`);
    
    const matchups = await fetchMatchups();
    console.log(`Fetched ${matchups.length} matchups`);
    
    const pitchers = await fetchPitchers(matchups);
    console.log(`Fetched ${pitchers.length} pitcher stats`);

    await saveToSupabase('team_stats', teams, 'team_abbr');
    await saveToSupabase('mlb_matchups', matchups, 'game_id');
    await saveToSupabase('pitcher_stats', pitchers, 'game_id,side');
    
    console.log('✅ MLB data update completed successfully.');
  } catch (error) {
    console.error('Failed to update MLB data:', error);
    process.exit(1);
  }
}

run().catch(console.error);
