// workers/syncCfbGames.js
// ────────────────────────────────────────────────────────────────
// • Pull FBS games for a season from CFBD
// • Auto-insert any team_id not yet in cfb.teams
// • Upsert into cfb.team_games
// ────────────────────────────────────────────────────────────────

try { (await import('dotenv')).config(); } catch {/* CI has env vars */}

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CFBD_API_KEY } = process.env;
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false }, db: { schema: 'cfb' } }
);

const season = Number(process.argv[2]) || new Date().getFullYear();

// ── helper: fetch schedule ──────────────────────────────────────
async function fetchSchedule() {
  const url = `https://api.collegefootballdata.com/games?year=${season}&classification=fbs`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${CFBD_API_KEY}` } });
  if (!res.ok) throw new Error(`CFBD ${res.status}: ${await res.text()}`);
  return res.json();           // array of games
}

// ── helper: insert unknown teams ────────────────────────────────
async function ensureTeamsExist(games) {
  const seen = new Map();                           // id → {name, conf, div}

  games.forEach(g => {
    seen.set(g.homeId, { name: g.homeTeam, conf: g.homeConference, div: g.homeClassification });
    seen.set(g.awayId, { name: g.awayTeam, conf: g.awayConference, div: g.awayClassification });
  });

  const allIds = [...seen.keys()];
  const { data: known, error: kErr } = await supabase.from('teams').select('team_id');
  if (kErr) throw kErr;

  const knownSet = new Set(known.map(t => t.team_id));
  const newRows = allIds
    .filter(id => !knownSet.has(id))
    .map(id => ({
      team_id:    id,
      team_name:  seen.get(id).name || `UNKNOWN_${id}`,
      conference: seen.get(id).conf || 'Unknown',
      division:   seen.get(id).div  || 'fbs'
    }));

  if (newRows.length) {
    const { error } = await supabase.from('teams').upsert(newRows);
    if (error) throw error;
    console.log(`ℹ️  Inserted ${newRows.length} previously-unknown team IDs`);
  }
}

// ── helper: build game rows ─────────────────────────────────────
function mapGame(g) {
  return {
    id:                   g.id,
    season:               g.season,
    week:                 g.week,
    season_type:          g.seasonType,
    start_date:           g.startDate,
    completed:            g.completed,

    home_id:              g.homeId,
    home_team:            g.homeTeam,
    home_conference:      g.homeConference,
    home_classification:  g.homeClassification,
    home_points:          g.homePoints,

    away_id:              g.awayId,
    away_team:            g.awayTeam,
    away_conference:      g.awayConference,
    away_classification:  g.awayClassification,
    away_points:          g.awayPoints,

    updated_at:           new Date().toISOString()
  };
}

// ── main run ────────────────────────────────────────────────────
async function run() {
  const games = await fetchSchedule();
  if (!games.length) { console.log('No games returned.'); return; }

  await ensureTeamsExist(games);

  const rows = games.map(mapGame);
  const { error, count } = await supabase
    .from('team_games')
    .upsert(rows, { ignoreDuplicates: false, count: 'exact' });

  if (error) throw error;
  console.log(`✅ Upserted ${count} game rows for ${season}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(err => { console.error(err); process.exit(1); });
}
