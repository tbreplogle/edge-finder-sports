// workers/fetchMlbOdds.js

import axios from 'axios';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';

// Configuration
const ODDS_API_KEY  = 'ca659a5203c1cfc6a0275ebd54c57262';
const ODDS_API_URL  = 'https://api.the-odds-api.com/v4/sports';
const SPORT_KEY     = 'baseball_mlb';
const ACTION_NAME   = 'fetch_mlb_odds';

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
  return res.data;
}

export function mapTeamIds(game) {
  const homeMap = getTeamMappingByName(game.home_team);
  const awayMap = getTeamMappingByName(game.away_team);
  if (!homeMap || !awayMap) return null;

  let home_ml = null;
  let away_ml = null;
  const m = game.bookmakers?.[0]?.markets.find(x => x.key === 'h2h');
  if (m?.outcomes) {
    const h = m.outcomes.find(o => o.name === game.home_team);
    const a = m.outcomes.find(o => o.name === game.away_team);
    if (h) home_ml = h.price;
    if (a) away_ml = a.price;
  }

  const ct = new Date(game.commence_time);
  const [mStr, dStr, yStr] = ct.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month:    '2-digit',
    day:      '2-digit',
    year:     'numeric'
  }).split('/');
  const game_date = `${yStr}-${mStr}-${dStr}`;

  const game_time_ct = ct.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    hour:     'numeric',
    minute:   '2-digit',
    hour12:   true
  });

  return {
    game_id:       game.id,
    game_date,
    game_time_utc: game_time_ct,
    home_team_id:  homeMap.team_id,
    away_team_id:  awayMap.team_id,
    home_ml,
    away_ml
  };
}

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
    return { ...g, matchup_id: map.get(key) || null };
  });
}

export async function upsertOdds(games) {
  const { data, error } = await supabase
    .from('mlb_market_odds')
    .upsert(games)
    .select();
  if (error) throw error;
  return data;
}

export async function logScrapeHistory(success, error_message = null, stats = {}) {
  await supabase
    .from('scrape_history')
    .insert({ action_name: ACTION_NAME, success, error_message, stats });
}

export async function fetchAndSyncMlbOdds() {
  try {
    if (!(await testConnection())) throw new Error('DB connection failed');
    const raw     = await fetchMlbOdds();
    const mapped  = raw.map(mapTeamIds).filter(x => x);
    const enriched= await findMatchupIds(mapped);
    await upsertOdds(enriched);
    await logScrapeHistory(true, null, {
      fetched: raw.length,
      mapped:  mapped.length,
      upserted: enriched.length
    });
  } catch (err) {
    await logScrapeHistory(false, err.message, {});
    process.exit(1);
  }
}

fetchAndSyncMlbOdds()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
