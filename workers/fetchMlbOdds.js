// workers/fetchMlbOdds.js

import axios from 'axios';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

const ODDS_API_KEY  = 'ca659a5203c1cfc6a0275ebd54c57262';
const ODDS_API_URL  = 'https://api.the-odds-api.com/v4/sports';
const SPORT_KEY     = 'baseball_mlb';
const ACTION_NAME   = 'fetch_mlb_odds';

const TEAM_NAME_TO_ID = {
  'SEATTLE MARINERS':       1,
  'CLEVELAND GUARDIANS':    2,
  'PITTSBURGH PIRATES':     3,
  'LOS ANGELES ANGELS':     4,
  'TORONTO BLUE JAYS':      5,
  'MIAMI MARLINS':          6,
  'OAKLAND ATHLETICS':      7,
  'NEW YORK YANKEES':       8,
  'TAMPA BAY RAYS':         9,
  'MINNESOTA TWINS':       10,
  'KANSAS CITY ROYALS':    11,
  'SAN FRANCISCO GIANTS':  12,
  'ARIZONA DIAMONDBACKS':  13,
  'MILWAUKEE BREWERS':     14,
  'CHICAGO WHITE SOX':     15,
  'CHICAGO CUBS':          16,
  'ATLANTA BRAVES':        17,
  'SAN DIEGO PADRES':      18,
  'HOUSTON ASTROS':        19,
  'NEW YORK METS':         20,
  'LOS ANGELES DODGERS':   21,
  'COLORADO ROCKIES':      22,
  'CINCINNATI REDS':       23,
  'WASHINGTON NATIONALS':  24,
  'DETROIT TIGERS':        25,
  'PHILADELPHIA PHILLIES': 26,
  'ST. LOUIS CARDINALS':   27,
  'TEXAS RANGERS':         28,
  'BOSTON RED SOX':        29,
  'BALTIMORE ORIOLES':     30
};

function getTeamMappingByName(name) {
  const key = name.trim().toUpperCase();
  const team_id = TEAM_NAME_TO_ID[key];
  return team_id ? { team_id } : null;
}

async function fetchOddsApi() {
  console.log('🕵️ Fetching MLB odds from the-odds-api...');
  const res = await axios.get(`${ODDS_API_URL}/${SPORT_KEY}/odds`, {
    params: {
      apiKey:     ODDS_API_KEY,
      regions:    'us',
      markets:    'h2h',
      oddsFormat: 'american',
      dateFormat: 'iso'
    }
  });
  if (!Array.isArray(res.data)) {
    throw new Error('Invalid response format from odds API');
  }
  console.log(`✅ Fetched ${res.data.length} games from odds API`);
  return res.data;
}

function mapTeamIds(game) {
  const home = getTeamMappingByName(game.home_team);
  const away = getTeamMappingByName(game.away_team);
  if (!home || !away) {
    console.warn(`⚠️ Skipping unmapped teams ${game.home_team} vs ${game.away_team}`);
    return null;
  }

  // Extract moneylines
  let home_ml = null, away_ml = null;
  const market = game.bookmakers?.[0]?.markets.find(m => m.key === 'h2h');
  if (market) {
    const h = market.outcomes.find(o => o.name === game.home_team);
    const a = market.outcomes.find(o => o.name === game.away_team);
    home_ml = h?.price ?? null;
    away_ml = a?.price ?? null;
  }

  // UTC → CT (CDT is UTC−5 in May). Then build:
  //  • game_date: YYYY-MM-DD in CT
  //  • game_time_ct: full ISO timestamp in CT for DB ingestion
  const utc = new Date(game.commence_time);
  const ct = new Date(utc.getTime() - 5 * 60 * 60 * 1000);
  
  const game_date    = ct.toISOString().slice(0, 10);
  const game_time_ct = ct.toISOString(); // e.g. "2025-05-08T12:10:00.000Z"

  return {
    game_id,
    game_id:       game.id,
    game_date,
    game_time_ct,
    home_team_id:  home.team_id,
    away_team_id:  away.team_id,
    home_ml,
    away_ml
  };
}

async function findMatchupIds(games) {
  console.log('🔗 Looking up matchup_ids...');
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
    return { ...g, matchup_id: map.get(key) ?? null };
  });
}

async function upsertOdds(games) {
  console.log(`→ Upserting ${games.length} records into mlb_market_odds...`);
  const { data, error } = await supabase
    .from('mlb_market_odds')
    .upsert(games)
    .select();
  if (error) throw error;
  console.log(`✅ Upserted ${data.length} records`);
  return data;
}

async function logHistory(success, error_message = null, stats = {}) {
  console.log(`📝 Logging scrape history: success=${success}`);
  await supabase
    .from('scrape_history')
    .insert({ action_name: ACTION_NAME, success, error_message, stats });
}

export async function fetchAndSyncMlbOdds() {
  console.log(`🏁 Starting MLB odds sync at ${new Date().toISOString()}`);
  const stats = { fetched:0, mapped:0, with_matchup:0, upserted:0 };

  try {
    if (!(await testConnection())) throw new Error('Database connection failed');

    const raw    = await fetchOddsApi();
    stats.fetched = raw.length;

    const mapped = raw.map(mapTeamIds).filter(x => x !== null);
    stats.mapped  = mapped.length;
    if (!mapped.length) throw new Error('No games mapped to team_ids');

    const enriched = await findMatchupIds(mapped);
    stats.with_matchup = enriched.filter(g => g.matchup_id).length;

    const upserted = await upsertOdds(enriched);
    stats.upserted = upserted.length;

    await logHistory(true, null, stats);
    console.log('🎉 MLB odds sync completed', stats);
    return { success: true, stats };
  } catch (err) {
    console.error('❌ MLB odds sync failed:', err.message);
    await logHistory(false, err.message, stats);
    return { success: false, error: err.message, stats };
  }
}

(async () => {
  const result = await fetchAndSyncMlbOdds();
  process.exit(result.success ? 0 : 1);
})();
