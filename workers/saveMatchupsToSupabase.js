
import { supabase } from './lib/supabaseClient.js';
import { getAllMatchupDetails } from './scrapeMatchupDetails.js';

/**
 * Transforms matchup details into a format suitable for Supabase
 * @param {object} matchup - The matchup details
 * @returns {object} The transformed data ready for insertion
 */
function transformMatchupForDb(matchup) {
  // Extract ERA and WHIP for home and away bullpens
  const homeBullpenStats = matchup.bullpens[matchup.homeTeam] || {};
  const awayBullpenStats = matchup.bullpens[matchup.awayTeam] || {};
  
  return {
    game_id: matchup.matchupId,
    game_date: new Date().toISOString().slice(0, 10), // Today's date
    home_team: matchup.homeTeam,
    away_team: matchup.awayTeam,
    home_pitcher: matchup.homePitcher,
    away_pitcher: matchup.awayPitcher,
    home_bullpen_era: parseFloat(homeBullpenStats.ERA) || null,
    home_bullpen_whip: parseFloat(homeBullpenStats.WHIP) || null,
    away_bullpen_era: parseFloat(awayBullpenStats.ERA) || null,
    away_bullpen_whip: parseFloat(awayBullpenStats.WHIP) || null
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
    
    // Save to Supabase
    const { data, error } = await supabase
      .from('mlb_matchups')
      .upsert(transformedMatchups, {
        onConflict: 'game_id',
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
