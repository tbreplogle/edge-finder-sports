// workers/fetchMlbOdds.js

import axios from 'axios';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';
import { mlbTeamMappings, getTeamMappingByName } from '../src/utils/helpers/teamMappings.js';

// Configuration
const ODDS_API_KEY = 'ca659a5203c1cfc6a0275ebd54c57262';
const ODDS_API_URL = 'https://api.the-odds-api.com/v4/sports';
const SPORT_KEY = 'baseball_mlb';
const ACTION_NAME = 'fetch_mlb_odds';

/**
 * Fetches MLB moneyline odds from the Odds API
 * @returns {Promise<Array>} Array of games with odds data
 */
export async function fetchMlbOdds() {
  try {
    console.log('Fetching MLB odds data from the-odds-api...');
    const response = await axios.get(`${ODDS_API_URL}/${SPORT_KEY}/odds`, {
      params: {
        apiKey: ODDS_API_KEY,
        regions: 'us',
        markets: 'h2h',
        oddsFormat: 'american',
        dateFormat: 'iso'
      }
    });

    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Invalid response format from odds API');
    }

    console.log(`✅ Fetched ${response.data.length} games from Odds API`);
    return response.data;
  } catch (err) {
    console.error('❌ Error fetching odds:', err.message);
    throw err;
  }
}

/**
 * Maps team names to our database team IDs
 * @param {Object} game - A game object from the Odds API 
 * @returns {Object|null} Mapped game with team IDs or null if mapping failed
 */
export function mapTeamIds(game) {
  try {
    const homeTeamMapping = getTeamMappingByName(game.home_team);
    const awayTeamMapping = getTeamMappingByName(game.away_team);

    if (!homeTeamMapping) {
      console.warn(`⚠️ Could not map home team: ${game.home_team}`);
      return null;
    }
    if (!awayTeamMapping) {
      console.warn(`⚠️ Could not map away team: ${game.away_team}`);
      return null;
    }

    let homeMoneyline = null;
    let awayMoneyline = null;

    if (game.bookmakers && game.bookmakers.length > 0) {
      const market = game.bookmakers[0].markets.find(m => m.key === 'h2h');
      if (market && market.outcomes) {
        const homeOutcome = market.outcomes.find(o => o.name === game.home_team);
        const awayOutcome = market.outcomes.find(o => o.name === game.away_team);
        if (homeOutcome) homeMoneyline = homeOutcome.price;
        if (awayOutcome) awayMoneyline = awayOutcome.price;
      }
    }

    const gameDate = new Date(game.commence_time).toISOString().split('T')[0];

    return {
      game_id:      game.id,
      game_date:    gameDate,
      game_time_utc: game.commence_time,
      home_team_id: homeTeamMapping.team_id,
      away_team_id: awayTeamMapping.team_id,
      home_ml:      homeMoneyline,
      away_ml:      awayMoneyline
    };
  } catch (err) {
    console.error(`❌ Error mapping team IDs for game ${game.id}:`, err.message);
    return null;
  }
}

/**
 * Find matchup_id by joining with mlb_matchups table
 * @param {Array} games - Array of mapped games with team IDs
 * @returns {Promise<Array>} Games with matchup_ids added where available
 */
export async function findMatchupIds(games) {
  try {
    const { data: matchups, error } = await supabase
      .from('mlb_matchups')
      .select('matchup_id, home_team_id, away_team_id, game_date');
    if (error) throw error;

    const matchupMap = new Map();
    matchups.forEach(m => {
      const key = `${m.home_team_id}_${m.away_team_id}_${m.game_date}`;
      matchupMap.set(key, m.matchup_id);
    });

    return games.map(game => {
      const lookupKey = `${game.home_team_id}_${game.away_team_id}_${game.game_date}`;
      const matchupId = matchupMap.get(lookupKey) || null;
      if (!matchupId) {
        console.warn(`⚠️ No matchup found for game ${game.game_id} (${lookupKey})`);
      }
      return { ...game, matchup_id: matchupId };
    });
  } catch (err) {
    console.error('❌ Error finding matchup IDs:', err.message);
    throw err;
  }
}

/**
 * Upsert odds data into mlb_market_odds table
 * @param {Array} games - Array of games with odds data
 * @returns {Promise<Array>} Result of the upsert operation
 */
export async function upsertOdds(games) {
  try {
    console.log(`→ Upserting ${games.length} odds records to database...`);
    const { data, error } = await supabase
      .from('mlb_market_odds')
      .upsert(games)
      .select();
    if (error) throw error;
    console.log(`✅ Successfully upserted ${data.length} odds records.`);
    return data;
  } catch (err) {
    console.error('❌ Error upserting odds data:', err.message);
    throw err;
  }
}

/**
 * Log scrape history record
 * @param {boolean} success 
 * @param {string|null} errorMessage 
 * @param {Object} stats 
 */
export async function logScrapeHistory(success, errorMessage = null, stats = {}) {
  try {
    const record = { action_name: ACTION_NAME, success, error_message: errorMessage, stats };
    const { error } = await supabase.from('scrape_history').insert(record);
    if (error) {
      console.error('❌ Error logging scrape history:', error.message);
    } else {
      console.log('✅ Scrape history logged successfully');
    }
  } catch (err) {
    console.error('❌ Error logging scrape history:', err.message);
  }
}

/**
 * Main function to fetch and sync MLB odds
 */
export async function fetchAndSyncMlbOdds() {
  console.log(`🏁 Starting MLB odds sync at ${new Date().toISOString()}...`);
  try {
    if (!(await testConnection())) {
      throw new Error('Database connection failed');
    }

    const rawGames    = await fetchMlbOdds();
    const mappedGames = rawGames.map(mapTeamIds).filter(g => g !== null);
    console.log(`→ Mapped ${mappedGames.length}/${rawGames.length} games to team IDs`);

    if (mappedGames.length === 0) {
      throw new Error('No games could be mapped to team IDs');
    }

    const enrichedGames      = await findMatchupIds(mappedGames);
    const withMatchupCount   = enrichedGames.filter(g => g.matchup_id).length;
    console.log(`→ Found matchup_ids for ${withMatchupCount}/${enrichedGames.length} games`);

    const upserted = await upsertOdds(enrichedGames);

    await logScrapeHistory(true, null, {
      total_fetched:       rawGames.length,
      total_mapped:        mappedGames.length,
      total_with_matchup:  withMatchupCount,
      total_upserted:      upserted.length
    });

    console.log('✅ MLB odds sync completed successfully!');
    return { success: true, stats: { total_fetched: rawGames.length, total_upserted: upserted.length } };
  } catch (err) {
    console.error('❌ MLB odds sync failed:', err.message);
    await logScrapeHistory(false, err.message, { error: err.toString() });
    return { success: false, error: err.message };
  }
}

// Invoke the sync unconditionally
fetchAndSyncMlbOdds()
  .then(res => process.exit(res.success ? 0 : 1))
  .catch(err => {
    console.error('❌ MLB odds sync fatal error:', err);
    process.exit(1);
  });
