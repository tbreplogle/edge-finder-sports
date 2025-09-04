// workers/syncCfbLines.js
// Pull lines for a season, ensure teams exist, upsert exactly ONE line per game.
// Prefers DraftKings but falls back to other providers if DK is missing.

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
  'draftkings', 'dk',
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

// ---------- helpers ----------
function ts(x) {
  if (!x) return 0;
  const d = new Date(x);
  return Number.isNaN(+d) ? 0 : +d;
}

function pickPreferredLine(lines = []) {
  if (!Array.isArray(lines) || lines.length === 0) return {};

  // group by provider (lowercased)
  const buckets = new Map();
  for (const l of lines) {
    const prov = String(l?.provider ?? '').toLowerCase();
    if (!buckets.has(prov)) buckets.set(prov, []);
    buckets.get(prov).push(l);
  }

  const chooseFromBucket = (arr) => {
    if (!arr || arr.length === 0) return {};
    const withSpread = arr.filter(x => typeof x?.spread === 'number');
    if (withSpread.length) {
      withSpread.sort((a,b) => ts(b.lastUpdated || b.updated || b.timestamp) - ts(a.lastUpdated || a.updated || a.timestamp));
      return withSpread[0];
    }
    const withOU = arr.filter(x => typeof x?.overUnder === 'number');
    if (withOU.length) {
      withOU.sort((a,b) => ts(b.lastUpdated || b.updated || b.timestamp) - ts(a.lastUpdated || a.updated || a.timestamp));
      return withOU[0];
    }
    arr.sort((a,b) => ts(b.lastUpdated || b.updated || b.timestamp) - ts(a.lastUpdated || a.updated || a.timestamp));
    return arr[0];
  };

  for (const wanted of PROVIDER_PRIORITY) {
    if (buckets.has(wanted)) return chooseFromBucket(buckets.get(wanted));
  }
  return chooseFromBucket(lines);
}

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

  const toInsert = [...seen.keys()]
    .filter(n => !knownSet.has(n))
    .map(n => ({
      team_id:    null,                        // set below
      team_name:  n,
      alt_name:   n,                           // NOT NULL
      conference: seen.get(n)?.conf ?? 'Unknown',
      division:   seen.get(n)?.div  ?? 'fbs'
    }));

  if (!toInsert.length) return;

  const existingIds = (known ?? []).map(t => t.team_id).filter(v => Number.isInteger(v));
  const minExisting  = existingIds.length ? Math.min(...existingIds) : 0;
  let nextId = Math.min(minExisting, 0) - 1;
  for (const r of toInsert) r.team_id = nextId--;

  const { error: insErr } = await supabase.from('teams').insert(toInsert);
  if (insErr) throw insErr;

  console.log(`ℹ️  Inserted ${toInsert.length} placeholder team rows`);
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

    // provider intentionally NOT persisted (column not present)
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

async function run() {
  const games = await fetchLines();
  if (!games?.length) { console.log('No lines returned.'); return; }

  await ensureTeamsExist(games);

  const { data: teamRows, error: tErr } = await supabase
    .from('teams')
    .select('team_id, team_name, alt_name');
  if (tErr) throw tErr;

  const nameToId = new Map();
  for (const t of teamRows ?? []) {
    if (t.team_name && !nameToId.has(t.team_name)) nameToId.set(t.team_name, t.team_id);
    if (t.alt_name  && !nameToId.has(t.alt_name))  nameToId.set(t.alt_name,  t.team_id);
  }

  const rows = games.map(g => {
    const r = mapLine(g);
    r.home_id = nameToId.get(g.homeTeam) ?? null;
    r.away_id = nameToId.get(g.awayTeam) ?? null;
    return r;
  });

  const { error, count } = await supabase
    .from('game_lines')
    .upsert(rows, { ignoreDuplicates: false, count: 'exact' });

  if (error) throw error;
  console.log(`✅ Upserted ${count} line rows for ${season}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(err => { console.error(err); process.exit(1); });
}
