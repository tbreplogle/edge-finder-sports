// workers/fetchMlbOdds.js

import axios from 'axios';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

// Configuration
const ODDS_API_KEY  = 'ca659a5203c1cfc6a0275ebd54c57262';
const ODDS_API_URL  = 'https://api.the-odds-api.com/v4/sports';
const SPORT_KEY     = 'baseball_mlb';
const ACTION_NAME   = 'fetch_mlb_odds';

/**
 * A mapping from API team names to our internal team_id
 */
const TEAM_NAME_TO_ID = {
  'SEATTLE MARINERS':        1,
  'CLEVELAND GUARDIANS':     2,
  'PITTSBURGH PIRATES':      3,
  'LOS ANGELES ANGELS':      4,
  'TORONTO BLUE JAYS':       5,
  'MIAMI MARLINS':           6,
  'OAKLAND ATHLETICS':       7,
  'NEW YORK YANKEES':        8,
  'TAMPA BAY RAYS':          9,
  'MINNESOTA TWINS':        10,
  'KANSAS CITY ROYALS':     11,
  'SAN FRANCISCO GIANTS':   12,
  'ARIZONA DIAMONDBACKS':   13,
  'MILWAUKEE BREWERS':      14,
  'CHICAGO WHITE SOX':      15,
  'CHICAGO CUBS':           16,
  'ATLANTA BRAVES':         17,
  'SAN DIEGO PADRES':       18,
  'HOUSTON ASTROS':         19,
  'NEW YORK METS':          20,
  'LOS ANGELES DODGERS':    21,
  'COLORADO ROCKIES':       22,
  'CINCINNATI REDS':        23,
  'WASHINGTON NATIONALS':   24,
  'DETROIT TIGERS':         25,
  'PHILADELPHIA PHILLIES':  26,
  'ST. LOUIS CARDINALS':    27,
  'TEXAS RANGERS':          28,
  'BOSTON RED SOX':         29,
  'BALTIMORE ORIOLES':      30
};

/**
 * Look up our team_id by API-provided name
 */
function getTeamMappingByName(name) {
  const key = name.trim().toUpperCase();
  const team_id = TEAM_NAME_TO_ID[key];
  return team_id ? { team_id } : null;
}

/**
 * Fetches MLB moneyline odds from the Odds API
 */
export async function fetchMlbOdds() {
  console.log('Fetching MLB odds data from the-odds-api...');
  const res = await axios.get(`${ODDS_API_URL}/${SPORT_KEY}/odds`, {
    params: {
      apiKey:    ODDS_API_KEY,
      regions:   'us',
      markets:   'h2h',
      oddsFormat:'american',
      dateFormat:'iso'
    }
  });
  if (!Array.isArray(res.data)) {
    throw new Error('Invalid response format from odds API');
  }
  console.log(`✅ Fetched ${res.data.length} games from Odds API`);
  return res.data;
}

/**
 * Map API game to our schema, attaching team_ids, moneylines, and CT time
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

  let home_ml = null;
  let away_ml = null;
  if (game.bookmakers?.[0]?.markets) {
    const m = game.bookmakers[0].markets.find(x => x.key === 'h2h');
    if (m?.outcomes) {
      const h = m.outcomes.find(o => o.name === game.home_team);
      const a = m.outcomes.find(o => o.name === game.away_team);
      if (h) home_ml = h.price;
      if (a) away_ml = a.price;
    }
  }

  const game_date = new Date(game.commence_time)
    .toISOString()
    .split('T')[0];

  // Convert UTC commence_time into USA Central Time
  const game_time_utc = new Date(game.commence_time)
    .toLocaleString('sv', { timeZone: 'America/Chicago' });

  return {
    game_id:       game.id,
    game_date,
    game_time_utc,   // now contains CST/CDT timestamp
    home_team_id:  homeMap.team_id,
    away_team_id:  awayMap.team_id,
    home_ml,
    away_ml
  };
}

/**
 * Attach matchup_id by joining against mlb_matchups table
 */
export async function findMatchupIds(games) {
  const { data: mups, error } = await supabase
    .from('mlb_matchups')
    .select('matchup_id, home_team_id, away_team_id, game_date');
  if (error) throw error;

  const map = new Map();
  mups.forEach(m => {
    map.set(`${m.home_team_id}_${m.away_team_id}_${m.game_date}`, m.matchup_id);
  });

  return games.map(g => {
    const key = `${g.home_team_id}_${g.away_team_id}_${g.game_date}`;
    const matchup_id = map.get(key) || null;
    if (!matchup_id) {
      console.warn(`⚠️ No matchup for ${g.game_id} (${key})`);
    }
    return { ...g, matchup_id };
  });
}

/**
 * Upsert into mlb_market_odds
 */
export async function upsertOdds(games) {
  console.log(`→ Upserting ${games.length} odds records...`);
  const { data, error } = await supabase
    .from('mlb_market_odds')
    .upsert(games)
    .select();
  if (error) throw error;
  console.log(`✅ Upserted ${data.length} records.`);
  return data;
}

/**
 * Record success/failure in scrape_history
 */
export async function logScrapeHistory(success, error_message = null, stats = {}) {
  const rec = { action_name: ACTION_NAME, success, error_message, stats };
  const { error } = await supabase.from('scrape_history').insert(rec);
  if (error) {
    console.error('❌ Failed to log scrape history:', error.message);
  } else {
    console.log('✅ Scrape history logged');
  }
}

/**
 * Orchestrates the whole odds-sync workflow
 */
export async function fetchAndSyncMlbOdds() {
  console.log(`🏁 Starting MLB odds sync at ${new Date().toISOString()}`);
  try {
    if (!(await testConnection())) {
      throw new Error('Database connection failed');
    }

    const raw      = await fetchMlbOdds();
    const mapped   = raw.map(mapTeamIds).filter(x => x !== null);
    console.log(`→ Mapped ${mapped.length}/${raw.length} games`);

    if (!mapped.length) {
      throw new Error('No games mapped');
    }

    const enriched = await findMatchupIds(mapped);
    const withMup  = enriched.filter(g => g.matchup_id).length;
    console.log(`→ Found matchup_id for ${withMup}/${enriched.length}`);

    const upserted = await upsertOdds(enriched);

    await logScrapeHistory(true, null, {
      total_fetched:      raw.length,
      total_mapped:       mapped.length,
      total_with_matchup: withMup,
      total_upserted:     upserted.length
    });

    console.log('✅ MLB odds sync complete');
    return { success: true };
  } catch (err) {
    console.error('❌ MLB odds sync failed:', err.message);
    await logScrapeHistory(false, err.message, { error: err.toString() });
    return { success: false };
  }
}

// Run immediately if called directly
fetchAndSyncMlbOdds()
  .then(res => process.exit(res.success ? 0 : 1))
  .catch(() => process.exit(1));
