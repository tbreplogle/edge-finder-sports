
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

// Create date windows for smaller chunks (roughly 3-4 days each)
const dateWindows = [];
const totalDays = 14;
const chunkSize = 3; // 3-4 days per chunk

for (let i = 0; i < totalDays; i += chunkSize) {
  const windowStart = new Date(start);
  windowStart.setDate(start.getDate() + i);
  
  const windowEnd = new Date(start);
  windowEnd.setDate(start.getDate() + Math.min(i + chunkSize, totalDays));
  
  dateWindows.push({
    from: windowStart.toISOString().slice(0, 10),
    to: windowEnd.toISOString().slice(0, 10)
  });
}

console.log('Date windows:', dateWindows);

// ✅ API URLs
const MLB_API = 'https://statsapi.mlb.com/api/v1';
const SAVANT_CSV = 'https://baseballsavant.mlb.com/statcast_search/csv';

// 1. Pull team stats from Baseball Savant
async function fetchTeamStats() {
  try {
    console.log('Fetching team stats from Baseball Savant...');
    
    const teamData = [];
    
    // Fetch data from each smaller time window
    for (const window of dateWindows) {
      const url = `${SAVANT_CSV}?all=true&player_type=team&hfGT=R%7C&hfDateGt=${window.from}&hfDateLt=${window.to}`;
      console.log(`Fetching team stats for window ${window.from} to ${window.to}...`);
      console.log(`URL: ${url}`);
      
      try {
        const response = await axios.get(url, {
          timeout: 60000 // 60 second timeout
        });
        
        const rows = parse(response.data, { columns: true });
        teamData.push(...rows);
        console.log(`Fetched ${rows.length} rows from ${window.from} to ${window.to}`);
      } catch (error) {
        console.warn(`Error fetching window ${window.from} to ${window.to}: ${error.message}`);
        // Continue with other windows even if one fails
      }
      
      // Small delay between requests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Total team data rows: ${teamData.length}`);
    
    // Process team stats
    const teamMap = {};
    for (const row of teamData) {
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
      date: today.toISOString().slice(0, 10),
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
        game_date: today.toISOString().slice(0, 10),
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
      const pid = m[`${side}_pitcher_id`]; 
      if (!pid) continue;

      let pitcherData = [];
      
      // Fetch data for each date window
      for (const window of dateWindows) {
        const url = `${SAVANT_CSV}?player_type=pitcher&player_id=${pid}&game_date_gt=${window.from}&game_date_lt=${window.to}&all=true`;
        
        try {
          console.log(`Fetching pitcher ${pid} data for window ${window.from} to ${window.to}`);
          const { data: csvData } = await axios.get(url, {
            timeout: 30000 // 30 second timeout
          });
          
          const rows = parse(csvData, { columns: true });
          pitcherData.push(...rows);
          console.log(`Fetched ${rows.length} rows for pitcher ${pid} from ${window.from} to ${window.to}`);
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          console.warn(`Error fetching pitcher ${pid} for window ${window.from} to ${window.to}:`, err.message);
          // Continue with other windows
        }
      }
      
      if (pitcherData.length === 0) {
        console.warn(`No data found for pitcher ${pid}`);
        continue;
      }
      
      const ip = pitcherData.reduce((s, r) => s + +r.ip, 0);
      const er = pitcherData.reduce((s, r) => s + +r.er, 0);
      const h = pitcherData.reduce((s, r) => s + +r.h, 0);
      const bb = pitcherData.reduce((s, r) => s + +r.bb, 0);
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
