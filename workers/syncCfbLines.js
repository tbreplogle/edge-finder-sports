// workers/syncCfbLines.js
// ────────────────────────────────────────────────────────────────
// Pull lines for a season, ensure teams exist, and upsert exactly
// one line per game into cfb.game_lines. Prefer DraftKings, but
// fall back to other providers when DK is missing.
// ────────────────────────────────────────────────────────────────

try { (await import('dotenv')).config(); } catch {}

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CFBD_API_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false }, db: { schema: 'cfb' } }
);

// Usage: node workers/syncCfbLines.js 2025
const season = Number(process.argv[2]) || new Date().getFullYear();

// Provider priority (lowercased for matching)
const PROVIDER_PRIORITY = [
  'draftkings', 'dk',           // your first choice(s)
  'consensus',
  'caesars',
  'fanduel',
  'betmgm',
  'circa sports',
  'pointsbet',
  'barstool',
  'bet365',
  'william hill'
];

/* ---------- Helpers ---------- */

// Parse a timestamp-ish field safely; returns numeric epoch ms or 0
function ts(x) {
  if (!x) return 0;
  const d = new Date(x);
  return Number.isNaN(+d) ? 0 : +d;
}

// Choose exactly ONE line object from an array, preferring provider order,
// and (within a provider) preferring entries with spread, then OU, using
// the most recently updated if timestamps exist.
function pickPreferredLine(lines = []) {
  if (!Array.isArray(lines) || lines.length === 0) return {};

  // Group by provider (lowercased)
  const buckets = new Map();
  for (const l of lines) {
    const prov = String(l?.provider ?? '').toLowerCase();
    if (!buckets.has(prov)) buckets.set(prov, []);
    buckets.get(prov).push(l);
  }

  // Within a bucket, pick "best" entry
  const chooseFromBucket = (arr) => {
    if (!arr || arr.length === 0) return {};
    // Prefer entries with numeric spread
    const withSpread = arr.filter(x => typeof x?.spread === 'number');
    if (withSpread.length) {
      // If there are timestamps, take the latest
      withSpread.sort((a,b) => ts(b.lastUpdated || b.updated || b.timestamp) - ts(a.lastUpdated || a.updated || a.timestamp));
      return withSpread[0];
    }
    // Else prefer entries with numeric OU
    const withOU = arr.filter(x => typeof x?.overUnder === 'number');
    if (withOU.length) {
      withOU.sort((a,b) => ts(b.lastUpdated || b.updated || b.timestamp) - ts(a.lastUpdated || a.updated || a.timestamp));
      return withOU[0];
    }
    // Else just take the most recently updated record
    arr.sort((a,b) => ts(b.lastUpdated || b.updated || b.timestamp) - ts(a.lastUpdated || a.updated || a.timestamp));
    return arr[0];
  };

  // Try providers in priority order
  for (const wanted of PROVIDER_PRIORITY) {
    if (buckets.has(wanted)) {
      return chooseFromBucket(buckets.get(wanted));
    }
  }

  // Fallback: any provider, pick best among ALL entries
  return chooseFromBucket(lines);
}

// Map one game into the game_lines row using the chosen single line
function mapLine(game) {
  const l = pickPreferredLine(game.lines || []);
  return {
    id:                  game.id,
    season:              game.season,
    season_type:         game.seasonType,
    week:                game.week,
    start_date:          game.startDate,

    home_team:           game.homeTeam,
    home_conference:     game.homeConference,
    home_classification: game.homeClassification,

    away_team:           game.awayTeam,
    away_conference:     game.awayConference,
    away_classification: game.awayClassification,

    // Line fields (may be undefined if provider didn’t supply)
    provider:            l?.provider ?? null,
    spread:              typeof l?.spread === 'number' ? l.spread : null,
    spread_open:         typeof l?.spreadOpen === 'number' ? l.spreadOpen : null,
    formatted_spread:    l?.formattedSpread ?? null,
    over_under:          typeof l?.overUnder === 'number' ? l.overUnder : null,
    over_under_open:     typeof l?.overUnderOpen === 'number' ? l.overUnderOpen : null,
    home_moneyline:      typeof l?.homeMoneyline === 'number' ? l.homeMoneyline : null,
    away_moneyline:      typeof l?.awayMoneyline === 'number' ? l.awayMoneyline : null,

    updated_at:          new Date().toISOString()
  };
}

/* ---------- Supabase ops ---------- */

// Fetch all lines from CFBD
async function fetchLines() {
  const url = `https://api.collegefootballdata.com/lines?year=${season}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${CFBD_API_KEY}` } });
  if (!res.ok) throw new Error(`CFBD ${res.status}: ${await res.text()}`);
  return res.json();
}

// Insert unknown teams with alt_name = team_name (NOT NULL), using negative IDs
async function ensureTeamsExist(games) {
  const seen = new Map(); // name -> { conf, div }
  for (const g of games) {
    if (g.homeTeam) seen.set(g.homeTeam, { conf: g.homeConference, div: g.homeClassification });
    if (g.awayTeam) seen.set(g.awayTeam, { conf: g.awayConference, div: g.awayClassification });
  }

  const { data: known, error } = await supabase
    .from('teams')
    .select('team_id, team_name, alt_name');
  if (error) throw error;

  const knownSet = new Set();
  for (const t of known ?? []) {
    if (t.team_name) knownSet.add(t.team_name);
    if (t.alt_name)  knownSet.add(t.alt_name);
  }

  const names = [...seen.keys()];
  const toInsert = names
    .filter(n => !knownSet.has(n))
    .map(n => ({
      team_id:    null,                        // set below
      team_name:  n,
      alt_name:   n,                           // NOT NULL
      conference: seen.get(n)?.conf ?? 'Unknown',
      division:   seen.get(n)?.div  ?? 'fbs'
    }));

  if (!toInsert.length) return;

  // Make negative IDs that won’t collide with positive CFBD ids
  const existingIds = (known ?? []).map(t => t.team_id).filter(v => Number.isInteger(v));
  const minExisting  = existingIds.length ? Math.min(...existingIds) : 0;
  let nextId = Math.min(minExisting, 0) - 1;
  for (const r of toInsert) r.team_id = nextId--;

  const { error: insErr } = await supabase.from('teams').insert(toInsert);
  if (insErr) throw insErr;

  console.log(`ℹ️  Inserted ${toInsert.length} placeholder team rows`);
}

/* ---------- Main ---------- */

async function run() {
  const games = await fetchLines();
  if (!games?.length) { console.log('No lines returned.'); return; }

  // Ensure team records exist first
  await ensureTeamsExist(games);

  // Build name->id map using both team_name and alt_name
  const { data: teamRows, error: tErr } = await supabase
    .from('teams')
    .select('team_id, team_name, alt_name');
  if (tErr) throw tErr;

  const nameToId = new Map();
  for (const t of teamRows ?? []) {
    if (t.team_name && !nameToId.has(t.team_name)) nameToId.set(t.team_name, t.team_id);
    if (t.alt_name  && !nameToId.has(t.alt_name))  nameToId.set(t.alt_name,  t.team_id);
  }

  // Map each game to a single-row payload, attaching home_id/away_id
  const rows = games.map(g => {
    const r = mapLine(g);
    r.home_id = nameToId.get(g.homeTeam) ?? null;
    r.away_id = nameToId.get(g.awayTeam) ?? null;
    return r;
  });

  // Upsert (one row per game id). If you have a PK/unique on id, this will keep it to 1/game.
  const { error, count } = await supabase
    .from('game_lines')
    .upsert(rows, { ignoreDuplicates: false, count: 'exact' });

  if (error) throw error;
  console.log(`✅ Upserted ${count} line rows for ${season}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(err => { console.error(err); process.exit(1); });
}
