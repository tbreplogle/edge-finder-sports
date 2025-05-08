// workers/fetchMlbOdds.js
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { supabase, testConnection } from './lib/supabaseClient.js';

const ODDS_API_KEY  = 'ca659a5203c1cfc6a0275ebd54c57262';
const ODDS_API_URL  = 'https://api.the-odds-api.com/v4/sports';
const SPORT_KEY     = 'baseball_mlb';
const ACTION_NAME   = 'fetch_mlb_odds';

const TEAM_NAME_TO_ID = {
  'SEATTLE MARINERS':       1,  'CLEVELAND GUARDIANS':    2,
  'PITTSBURGH PIRATES':     3,  'LOS ANGELES ANGELS':     4,
  'TORONTO BLUE JAYS':      5,  'MIAMI MARLINS':          6,
  'OAKLAND ATHLETICS':      7,  'NEW YORK YANKEES':       8,
  'TAMPA BAY RAYS':         9,  'MINNESOTA TWINS':       10,
  'KANSAS CITY ROYALS':    11,  'SAN FRANCISCO GIANTS':  12,
  'ARIZONA DIAMONDBACKS':  13,  'MILWAUKEE BREWERS':     14,
  'CHICAGO WHITE SOX':     15,  'CHICAGO CUBS':          16,
  'ATLANTA BRAVES':        17,  'SAN DIEGO PADRES':      18,
  'HOUSTON ASTROS':        19,  'NEW YORK METS':         20,
  'LOS ANGELES DODGERS':   21,  'COLORADO ROCKIES':      22,
  'CINCINNATI REDS':       23,  'WASHINGTON NATIONALS':  24,
  'DETROIT TIGERS':        25,  'PHILADELPHIA PHILLIES': 26,
  'ST. LOUIS CARDINALS':   27,  'TEXAS RANGERS':         28,
  'BOSTON RED SOX':        29,  'BALTIMORE ORIOLES':     30
};

function getTeamMappingByName(name) {
  const team_id = TEAM_NAME_TO_ID[name.trim().toUpperCase()];
  return team_id ? { team_id } : null;
}

async function fetchOddsApi() {
  console.log('🕵️ Fetching MLB odds from the‑odds‑api…');
  const { data } = await axios.get(`${ODDS_API_URL}/${SPORT_KEY}/odds`, {
    params: {
      apiKey: ODDS_API_KEY,
      regions: 'us',
      markets: 'h2h',
      oddsFormat: 'american',
      dateFormat: 'iso'
    }
  });
  if (!Array.isArray(data)) throw new Error('Unexpected API response');
  console.log(`✅ Fetched ${data.length} games`);
  return data;
}

function mapGame(game) {
  const home = getTeamMappingByName(game.home_team);
  const away = getTeamMappingByName(game.away_team);
  if (!home || !away) {
    console.warn(`⚠️ Unmapped teams: ${game.home_team} vs ${game.away_team}`);
    return null;
  }

  const market = game.bookmakers?.[0]?.markets.find(m => m.key === 'h2h');
  const h2h    = market?.outcomes ?? [];
  const hML    = h2h.find(o => o.name === game.home_team)?.price ?? null;
  const aML    = h2h.find(o => o.name === game.away_team)?.price ?? null;

  const utc  = new Date(game.commence_time);
  const cdt  = new Date(utc.getTime() - 5 * 60 * 60 * 1e3);      // UTC‑5
  const date = cdt.toISOString().slice(0, 10);

  return {
    game_id:       game.id,
    game_date:     date,
    game_time_ct:  cdt.toISOString(),
    home_team_id:  home.team_id,
    away_team_id:  away.team_id,
    home_ml:       hML,
    away_ml:       aML
  };
}

async function attachMatchupIds(records) {
  const { data, error } = await supabase
    .from('mlb_matchups')
    .select('matchup_id, home_team_id, away_team_id, game_date');
  if (error) throw error;

  const map = new Map(
    data.map(m => [
      `${m.home_team_id}_${m.away_team_id}_${m.game_date}`,
      m.matchup_id
    ])
  );

  return records.map(r => ({
    ...r,
    matchup_id: map.get(`${r.home_team_id}_${r.away_team_id}_${r.game_date}`) ?? null
  }));
}

async function upsertOdds(records) {
  console.log(`→ Upserting ${records.length} records…`);
  const { data, error } = await supabase
    .from('mlb_market_odds')
    .upsert(records)
    .select();
  if (error) throw error;
  console.log(`✅ Upserted ${data.length}`);
  return data.length;
}

async function fetchAndSyncMlbOdds() {
  console.log(`🏁 Sync started ${new Date().toISOString()}`);
  const stats = { fetched: 0, mapped: 0, with_matchup: 0, upserted: 0 };

  try {
    if (!(await testConnection())) throw new Error('DB connection failed');

    const raw   = await fetchOddsApi();               stats.fetched = raw.length;
    const mapped = raw.map(mapGame).filter(Boolean);  stats.mapped  = mapped.length;
    if (!mapped.length) throw new Error('No mapped games');

    const joined = await attachMatchupIds(mapped);
    stats.with_matchup = joined.filter(x => x.matchup_id).length;

    stats.upserted = await upsertOdds(joined);
    console.log('🎉 Sync complete', stats);
    return { success: true, stats };
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
    return { success: false, error: err.message, stats };
  }
}

/* ---------- RUN WHEN CALLED DIRECTLY ---------- */
const isEntry =
  process.argv[1] ===
  resolve(dirname(fileURLToPath(import.meta.url)), 'fetchMlbOdds.js');

if (isEntry) {
  fetchAndSyncMlbOdds()
    .then(res => process.exit(res.success ? 0 : 1))
    .catch(() => process.exit(1));
}
