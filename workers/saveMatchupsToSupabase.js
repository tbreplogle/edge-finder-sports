
import { supabase } from './lib/supabaseClient.js';
import { getAllMatchupDetails } from './scrapeMatchupDetails.js';

/**
 * Transforms matchup details into a format suitable for Supabase
 * @param {object} matchup - The matchup details
 * @returns {object} The transformed data ready for insertion
 */
function transformMatchupForDb(matchup) {
  // Extract all bullpen stats for home and away teams
  const homeBullpenStats = matchup.bullpens[matchup.homeTeam] || {};
  const awayBullpenStats = matchup.bullpens[matchup.awayTeam] || {};
  
  return {
    matchup_id: matchup.matchupId,
    game_date: new Date().toISOString().slice(0, 10), // Today's date
    home_team: matchup.homeTeam,
    away_team: matchup.awayTeam,
    home_pitcher: matchup.homePitcher,
    away_pitcher: matchup.awayPitcher,
    
    // Home bullpen stats with proper type conversion
    bullpen_home_era: parseFloat(homeBullpenStats.ERA) || null,
    bullpen_home_whip: parseFloat(homeBullpenStats.WHIP) || null,
    bullpen_home_avg: parseFloat(homeBullpenStats.AVG) || null,
    bullpen_home_obp: parseFloat(homeBullpenStats.OBP) || null,
    bullpen_home_ip: parseFloat(homeBullpenStats.IP) || null,
    bullpen_home_hr: parseInt(homeBullpenStats.HR) || null,
    bullpen_home_bb: parseInt(homeBullpenStats.BB) || null,
    bullpen_home_k: parseInt(homeBullpenStats.K) || null,
    
    // Away bullpen stats with proper type conversion
    bullpen_away_era: parseFloat(awayBullpenStats.ERA) || null,
    bullpen_away_whip: parseFloat(awayBullpenStats.WHIP) || null,
    bullpen_away_avg: parseFloat(awayBullpenStats.AVG) || null,
    bullpen_away_obp: parseFloat(awayBullpenStats.OBP) || null,
    bullpen_away_ip: parseFloat(awayBullpenStats.IP) || null,
    bullpen_away_hr: parseInt(awayBullpenStats.HR) || null,
    bullpen_away_bb: parseInt(awayBullpenStats.BB) || null,
    bullpen_away_k: parseInt(awayBullpenStats.K) || null
  };
}

/**
 * Saves matchup details to Supabase
 * @returns {Promise<void>}
 */
export async function saveMatchupsToSupabase() {
  try {
    console.log('Starting MLB matchup data import to Supabase...');
    
    // Fetch all matchup details
    const matchups = await getAllMatchupDetails();
    
    if (matchups.length === 0) {
      console.log('No matchup details to save');
      return;
    }
    
    console.log(`Preparing to save ${matchups.length} matchups to Supabase`);
    
    // Transform data for database
    const transformedMatchups = matchups.map(transformMatchupForDb);
    
    // Save to Supabase - note the table name change
    const { data, error } = await supabase
      .from('mlb_matchup_details')
      .upsert(transformedMatchups, {
        onConflict: 'matchup_id',
        ignoreDuplicates: false
      });
    
    if (error) {
      console.error('❌ Error saving matchups to Supabase:', error);
    } else {
      console.log(`✅ Successfully saved ${matchups.length} matchups to Supabase`);
    }
  } catch (error) {
    console.error('❌ Failed to save matchups:', error);
  }
}

// Run if script is executed directly
if (import.meta.url === import.meta.main) {
  saveMatchupsToSupabase().then(() => {
    console.log('MLB matchup import completed');
    process.exit(0);
  }).catch(error => {
    console.error('Fatal error in MLB matchup import:', error);
    process.exit(1);
  });
}
