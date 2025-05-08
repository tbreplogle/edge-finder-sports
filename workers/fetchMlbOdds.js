import axios from 'axios';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

// Configuration
const ODDS_API_KEY = 'ca659a5203c1cfc6a0275ebd54c57262';
const ODDS_API_URL = 'https://api.the-odds-api.com/v4/sports';
const SPORT_KEY   = 'baseball_mlb';
const ACTION_NAME = 'fetch_mlb_odds';

// In‑file team→ID mapping to avoid import path issues
const TEAM_NAME_MAP = {
  'Seattle Mariners':    1,
  'Cleveland Guardians': 2,
  'Pittsburgh Pirates':  3,
  'Los Angeles Angels':  4,
  'Toronto Blue Jays':   5,
  'Miami Marlins':       6,
  'Oakland Athletics':   7,
  'New York Yankees':    8,
  'Tampa Bay Rays':      9,
  'Minnesota Twins':     10,
  'Kansas City Royals':  11,
  'San Francisco Giants':12,
  'Arizona Diamondbacks':13,
  'Milwaukee Brewers':   14,
  'Chicago White Sox':   15,
  'Chicago Cubs':        16,
  'Atlanta Braves':      17,
  'San Diego Padres':    18,
  'Houston Astros':      19,
  'New York Mets':       20,
  'Los Angeles Dodgers': 21,
  'Colorado Rockies':    22,
  'Cincinnati Reds':     23,
  'Washington Nationals':24,
  'Detroit Tigers':      25,
  'Philadelphia Phillies':26,
  'St. Louis Cardinals': 27,
  'Texas Rangers':       28,
  'Boston Red Sox':      29,
  'Baltimore Orioles':   30
};

function getTeamMappingByName(name) {
  if (name.toUpperCase().includes('ATHLETICS') || name.includes('Oakland')) {
    return { team_id: TEAM_NAME_MAP['Oakland Athletics'] };
  }
  for (const key of Object.keys(TEAM_NAME_MAP)) {
    if (name.includes(key)) {
      return { team_id: TEAM_NAME_MAP[key] };
    }
  }
  return null;
}

/**
 * Fetches MLB moneyline odds from the Odds API
 * @returns {Promise<Array>}
 */
export async function fetchMlbOdds() {
  console.log('Fetching MLB odds data from the-odds-api...');
  const resp = await axios.get(`${ODDS_API_URL}/${SPORT_KEY}/odds`, {
    params: {
      apiKey:     ODDS_API_KEY,
      regions:    'us',
      markets:    'h2h',
      oddsFormat: 'american',
      dateFormat: 'iso'
    }
  });
  if (!Array.isArray(resp.data)) {
    throw new Error('Invalid response format from odds API');
  }
  console.log(`✅ Fetched ${resp.data.length} games from Odds API`);
  return resp.data;
}

/**
 * Maps team names to our database team IDs
 */
export function mapTeamIds(game) {
  const homeMap = getTeamMappingByName(game.home_team);
  const awayMap = getTeamMappingByName(game.away_team);
  if (!homeMap) {
    console.warn(`⚠️ Could not map home team: ${game.home_team}`);
    return null;
  }
  if (!awayMap) {
    console.warn(`⚠️ Could not map away team: ${game.away_team}`);
    return null;
  }

  let home_ml = null, away_ml = null;
  const bm = game.bookmakers?.[0];
  const market = bm?.markets.find(m => m.key === 'h2h');
  if (market) {
    const hO = market.outcomes.find(o => o.name === game.home_team);
    const aO = market.outcomes.find(o => o.name === game.away_team);
    if (hO) home_ml = hO.price;
    if (aO) away_ml = aO.price;
  }

  const gameDate = new Date(game.commence_time).toISOString().split('T')[0];

  return {
    game_id:      game.id,
    game_date:    gameDate,
    game_time_utc: game.commence_time,
    home_team_id: homeMap.team_id,
    away_team_id: awayMap.team_id,
    home_ml,
    away_ml
  };
}

/**
 * Finds matchup_id by joining with mlb_matchups
 */
export async function findMatchupIds(games) {
  const { data: matchups, error } = await supabase
    .from('mlb_matchups')
    .select('matchup_id,home_team_id,away_team_id,game_date');
  if (error) throw error;

  const map = new Map();
  matchups.forEach(m => {
    map.set(`${m.home_team_id}_${m.away_team_id}_${m.game_date}`, m.matchup_id);
  });

  return games.map(g => {
    const key = `${g.home_team_id}_${g.away_team_id}_${g.game_date}`;
    const matchup_id = map.get(key) || null;
    if (!matchup_id) {
      console.warn(`⚠️ No matchup for ${g.game_id}: ${g.home_team_id} vs ${g.away_team_id} on ${g.game_date}`);
    }
    return { ...g, matchup_id };
  });
}

/**
 * Upserts odds into mlb_market_odds
 */
export async function upsertOdds(games) {
  console.log(`→ Upserting ${games.length} odds records…`);
  const { data, error } = await supabase
    .from('mlb_market_odds')
    .upsert(games)
    .select();
  if (error) throw error;
  console.log(`✅ Upserted ${data.length} odds records.`);
  return data;
}

/**
 * Logs to scrape_history
 */
export async function logScrapeHistory(success, errorMessage = null, stats = {}) {
  const record = { action_name: ACTION_NAME, success, error_message: errorMessage, stats };
  const { error } = await supabase.from('scrape_history').insert(record);
  console.log(error ? '❌ Error logging scrape history:' + error.message : '✅ Scrape history logged');
}

/**
 * Main sync function
 */
export async function fetchAndSyncMlbOdds() {
  console.log(`🏁 Starting MLB odds sync at ${new Date().toISOString()}`);
  try {
    if (!(await testConnection())) throw new Error('DB connection failed');

    const raw = await fetchMlbOdds();
    const mapped = raw.map(mapTeamIds).filter(g => g !== null);
    if (!mapped.length) throw new Error('No games mapped');

    const enriched = await findMatchupIds(mapped);
    const upserted = await upsertOdds(enriched);

    await logScrapeHistory(true, null, {
      total_fetched: raw.length,
      total_mapped:  mapped.length,
      total_upserted: upserted.length
    });

    console.log('✅ MLB odds sync completed');
    return { success: true };
  } catch (err) {
    console.error('❌ MLB odds sync failed:', err.message);
    await logScrapeHistory(false, err.message, { error: err.toString() });
    return { success: false, error: err.message };
  }
}

if (import.meta.url === import.meta.main) {
  fetchAndSyncMlbOdds()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
