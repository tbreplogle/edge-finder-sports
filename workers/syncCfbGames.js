// workers/syncCfbGames.js
// ────────────────────────────────────────────────────────────────
// Upserts every FBS game for a given season into cfb.team_games.
// Default = current year; override via CLI arg.
// ────────────────────────────────────────────────────────────────

try { (await import('dotenv')).config(); } catch {/* no dotenv on CI */}

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CFBD_API_KEY } = process.env;
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false }, db: { schema: 'cfb' } }
);

const targetSeason = Number(process.argv[2]) || new Date().getFullYear();

async function run() {
  const url = `https://api.collegefootballdata.com/games?year=${targetSeason}&classification=fbs`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${CFBD_API_KEY}` } });
  if (!res.ok) throw new Error(`CFBD ${res.status}: ${await res.text()}`);
  const games = await res.json();               // array of games

  if (!games.length) { console.log('No games returned.'); return; }

  const rows = games.map(g => ({
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
  }));

  const { error, count } = await supabase
    .from('team_games')
    .upsert(rows, { ignoreDuplicates: false, count: 'exact' });

  if (error) throw error;
  console.log(`✅ Upserted ${count} game rows for ${targetSeason}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(err => { console.error(err); process.exit(1); });
}
