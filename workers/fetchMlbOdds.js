// workers/fetchMlbOdds.js

import axios from 'axios';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

const ODDS_API_KEY  = 'ca659a5203c1cfc6a0275ebd54c57262';
const ODDS_API_URL  = 'https://api.the-odds-api.com/v4/sports';
const SPORT_KEY     = 'baseball_mlb';
const ACTION_NAME   = 'fetch_mlb_odds';

// In‑memory mapping from API names to your team_id
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

function getTeamMappingByName(name) {
  const key = name.trim().toUpperCase();
  const team_id = TEAM_NAME_TO_ID[key];
  return team_id ? { team_id } : null;
}

export async function fetchMlbOdds() {
  console.log('Fetching MLB odds from the-odds-api…');
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
    throw new Error('Invalid response from odds API');
  }
  console.log(`✅ Fetched ${res.data.length} games`);
  return res.data;
}

export function mapTeamIds(game) {
  const homeMap = getTeamMappingByName(game.home_team);
  const awayMap = getTeamMappingByName(game.away_team);
  if (!homeMap || !awayMap) {
    console.warn(`⚠️  Could not map teams for game ${game.id}`);
    return null;
  }

  // extract moneylines
  let home_ml = null, away_ml = null;
  const market = game.bookmakers?.[0]?.markets?.find(m => m.key === 'h2h');
  if (market?.outcomes) {
    const h = market.outcomes.find(o => o.name === game.home_team);
    const a = market.outcomes.find(o => o.name === game.away_team);
    if (h) home_ml = h.price;
    if (a) away_ml = a.price;
  }

  const game_date = new Date(game.commence_time).toISOString().split('T')[0];
  // convert to Central time string
  const game_time_utc = new Date(game.commence_time)
    .toLocaleString('sv', { timeZone: 'America/Chicago' });

  return {
    game_id,
    game_date,
    game_time_utc,       // <— overwrite the existing UTC column with CT
    home_team_id: homeMap.team_id,
    away_team_id: awayMap.team_id,
    home_ml,
    away_ml
  };
}

export async function findMatchupIds(games) {
  const { data: mups, error } = await supabase
    .from('mlb_matchups')
    .select('matchup_id,home_team_id,away_team_id,game_date');
  if (error) throw error;

  const map = new Map();
  mups.forEach(m => {
    map.set(`${m.home_team_id}_${m.away_team_id}_${m.game_date}`, m.matchup_id);
  });

  return games.map(g => {
    const key = `${g.home_team_id}_${g.away_team_id}_${g.game_date}`;
    const matchup_id = map.get(key) || null;
    if (!matchup_id) {
      console.warn(`⚠️  No matchup for ${g.game_id} (${key})`);
    }
    return { ...g, matchup_id };
  });
}

export async function upsertOdds(games) {
  console.log(`→ Upserting ${games.length} records…`);
  const { data, error } = await supabase
    .from('mlb_market_odds')
    .upsert(games)
    .select();
  if (error) throw error;
  console.log(`✅ Upserted ${data.length}`);
  return data;
}

export async function logScrapeHistory(success, error_message = null, stats = {}) {
  const rec = { action_name: ACTION_NAME, success, error_message, stats };
  const { error } = await supabase.from('scrape_history').insert(rec);
  if (error) console.error('❌ Log failed:', error.message);
  else       console.log('✅ History logged');
}

export async function fetchAndSyncMlbOdds() {
  console.log(`🏁 Starting MLB odds sync…`);
  try {
    if (!(await testConnection())) throw new Error('DB connection failed');
    const raw      = await fetchMlbOdds();
    const mapped   = raw.map(mapTeamIds).filter(Boolean);
    console.log(`→ Mapped ${mapped.length}/${raw.length}`);
    if (!mapped.length) throw new Error('No games mapped');
    const enriched = await findMatchupIds(mapped);
    const withMup  = enriched.filter(g => g.matchup_id).length;
    console.log(`→ Found matchup: ${withMup}/${enriched.length}`);
    const upserted = await upsertOdds(enriched);
    await logScrapeHistory(true, null, {
      total_fetched:      raw.length,
      total_mapped:       mapped.length,
      total_with_matchup: withMup,
      total_upserted:     upserted.length
    });
    console.log('✅ MLB odds sync complete');
  } catch (err) {
    console.error('❌ MLB odds sync failed:', err.message);
    await logScrapeHistory(false, err.message, { error: err.toString() });
    process.exit(1);
  }
}

if (import.meta.url === import.meta.main) {
  fetchAndSyncMlbOdds().then(() => process.exit(0));
}
