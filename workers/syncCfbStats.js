// workers/syncCfbStats.js
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();   // loads .env in GitHub action or locally

/* --- env --- */
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  CFBD_API_KEY
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CFBD_API_KEY) {
  console.error('❌ Missing env vars. Check .env / GitHub secrets.');
  process.exit(1);
}

/* --- Supabase client (service role = can bypass RLS) --- */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

/* --- Helpers --------------------------------------------------- */
async function getTeamsMap() {
  const { data, error } = await supabase
    .from('cfb.teams')
    .select('team_id, team_name');
  if (error) throw error;
  return Object.fromEntries(data.map(({ team_id, team_name }) => [team_name, team_id]));
}

async function fetchAdvancedStats(year) {
  const url = `https://api.collegefootballdata.com/stats/season/advanced?year=${year}&excludeGarbageTime=true&startWeek=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${CFBD_API_KEY}` } });
  if (!res.ok) throw new Error(`CFBD API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function upsertStats(stats, teamMap) {
  // Build payload, skipping teams we don't recognise
  const rows = stats.flatMap(s => {
    const team_id = teamMap[s.team];
    if (!team_id) {
      console.warn(`⚠️  Unknown team "${s.team}" – skipping.`);
      return [];
    }
    return {
      season:     s.season,
      team_id,
      conference: s.conference ?? '',
      offense:    s.offense,
      defense:    s.defense
    };
  });

  if (!rows.length) {
    console.log('No rows to upsert.');
    return;
  }

  const { error, count } = await supabase
    .from('cfb.season_advanced_stats')
    .upsert(rows, { ignoreDuplicates: false, count: 'exact' });

  if (error) throw error;
  console.log(`✅ Upserted ${count} rows into cfb.season_advanced_stats`);
}

/* --- Main ------------------------------------------------------ */
(async () => {
  try {
    const season     = 2024;             // or new Date().getFullYear()
    const teamMap    = await getTeamsMap();
    const apiData    = await fetchAdvancedStats(season);
    await upsertStats(apiData, teamMap);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();
