// workers/syncCfbLines.js
// ────────────────────────────────────────────────────────────────
// Pull DraftKings lines for a season, insert unknown teams, upsert
// into cfb.game_lines.
// ────────────────────────────────────────────────────────────────

try { (await import('dotenv')).config(); } catch {}

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CFBD_API_KEY } = process.env;
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false }, db: { schema: 'cfb' } }
);

const season = Number(process.argv[2]) || new Date().getFullYear();

// ── fetch lines ─────────────────────────────────────────────────
async function fetchLines() {
  const url = `https://api.collegefootballdata.com/lines?year=${season}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${CFBD_API_KEY}` } });
  if (!res.ok) throw new Error(`CFBD ${res.status}: ${await res.text()}`);
  return res.json();   // array of games, each with .lines[]
}

// ── auto-insert unknown teams (by name only) ────────────────────
async function ensureTeamsExist(games) {
  const seen = new Map();      // name → {}

  games.forEach(g => {
    seen.set(g.homeTeam,  { conf: g.homeConference,  div: g.homeClassification  });
    seen.set(g.awayTeam,  { conf: g.awayConference,  div: g.awayClassification  });
  });

  const names = [...seen.keys()];
  const { data: known, error } = await supabase.from('teams').select('team_id, team_name');
  if (error) throw error;

  const knownSet = new Set(known.map(t => t.team_name));
  const newRows = names
    .filter(n => !knownSet.has(n))
    .map(n => ({
      team_id:    null,                 // let PG assign? no – need an id
      team_name:  n,
      conference: seen.get(n).conf || 'Unknown',
      division:   seen.get(n).div  || 'fbs'
    }));

  if (newRows.length) {
    /* Generate synthetic IDs: -1,-2,… so they never collide with real CFBD ids
       (CFBD ids are positive ints). */
    const minId = Math.min(...known.map(t => t.team_id), 0) - 1;
    newRows.forEach((r,i) => r.team_id = minId - i);

    const { error: e2 } = await supabase.from('teams').insert(newRows);
    if (e2) throw e2;
    console.log(`ℹ️  Inserted ${newRows.length} placeholder team rows`);
  }
}

// ── build game_lines row (use first element of .lines[]) ─────────
function mapLine(g) {
  const l = g.lines?.[0] ?? {};
  return {
    id:                   g.id,
    season:               g.season,
    season_type:          g.seasonType,
    week:                 g.week,
    start_date:           g.startDate,

    home_team:            g.homeTeam,
    home_conference:      g.homeConference,
    home_classification:  g.homeClassification,

    away_team:            g.awayTeam,
    away_conference:      g.awayConference,
    away_classification:  g.awayClassification,

    spread:               l.spread,
    spread_open:          l.spreadOpen,
    formatted_spread:     l.formattedSpread,
    over_under:           l.overUnder,
    over_under_open:      l.overUnderOpen,
    home_moneyline:       l.homeMoneyline,
    away_moneyline:       l.awayMoneyline,

    updated_at:           new Date().toISOString()
  };
}

// ── main ─────────────────────────────────────────────────────────
async function run() {
  const games = await fetchLines();
  if (!games.length) { console.log('No lines returned.'); return; }

  await ensureTeamsExist(games);

  // attach team_id FK using existing lookup
  const { data: teamRows } = await supabase.from('teams').select('team_id, team_name');
  const nameToId = Object.fromEntries(teamRows.map(t => [t.team_name, t.team_id]));

  const rows = games.map(g => {
    const r = mapLine(g);
    r.home_id = nameToId[g.homeTeam] ?? null;
    r.away_id = nameToId[g.awayTeam] ?? null;
    return r;
  });

  const { error, count } = await supabase
    .from('game_lines')
    .upsert(rows, { ignoreDuplicates: false, count: 'exact' });

  if (error) throw error;
  console.log(`✅ Upserted ${count} DraftKings line rows for ${season}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(err => { console.error(err); process.exit(1); });
}
