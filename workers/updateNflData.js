
import { supabase } from './lib/supabaseClient.js';
import axios from 'axios';

// ✅ Dates
const today = new Date();
const start = new Date(today);
start.setDate(today.getDate() - 14);
const startDate = start.toISOString().slice(0, 10);
const endDate = today.toISOString().slice(0, 10);

// API URLs - replace with real NFL endpoints when available
const NFL_API = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

// 1. Pull team stats
async function fetchTeamStats() {
  try {
    // In a real implementation, you'd fetch from NFL API
    // This is a placeholder to match the DB structure
    const { data } = await axios.get(`${NFL_API}/teams`);
    
    const teams = [];
    // Process teams and extract stats
    // For now we'll use placeholder data
    
    return teams;
  } catch (error) {
    console.error("Error fetching NFL team stats:", error.message);
    // Return empty array to avoid breaking the pipeline
    return [];
  }
}

// 2. Pull matchups
async function fetchMatchups() {
  try {
    // In a real implementation, you'd fetch from NFL API
    // For today's games/matchups
    const { data } = await axios.get(`${NFL_API}/scoreboard`);
    
    const matchups = [];
    // Process matchups from the API response
    
    return matchups;
  } catch (error) {
    console.error("Error fetching NFL matchups:", error.message);
    return [];
  }
}

// 3. Save to Supabase using RPC
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

// Main function to run the pipeline
async function run() {
  console.log('⏳ Pulling NFL data...');
  
  try {
    const teams = await fetchTeamStats();
    console.log(`Fetched ${teams.length} team stats`);
    
    const matchups = await fetchMatchups();
    console.log(`Fetched ${matchups.length} matchups`);

    // Save to the appropriate tables
    // You'll need to create these tables first
    await saveToSupabase('nfl_team_stats', teams, 'team_abbr');
    await saveToSupabase('nfl_matchups', matchups, 'game_id');
    
    console.log('✅ NFL data update completed successfully.');
  } catch (error) {
    console.error('Failed to update NFL data:', error);
    process.exit(1);
  }
}

run().catch(console.error);
