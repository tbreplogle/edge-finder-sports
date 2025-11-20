// workers/syncCbbTeams.js
// -----------------------
// Fetch team list from CollegeBasketballData and upsert into cbb.teams

// optional dotenv for local dev
try {
    const { config } = await import('dotenv');
    config();
  } catch {
    console.log('dotenv not installed – skipping .env load');
  }
  
  import fetch from 'node-fetch';
  import { createClient } from '@supabase/supabase-js';
  
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CFBD_API_KEY } = process.env;
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CFBD_API_KEY) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / CFBD_API_KEY');
    process.exit(1);
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    db: { schema: 'cbb' },
  });
  
  // small helper to fall back across possible key names
  const pick = (obj, keys) => {
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return null;
  };
  
  async function run(seasonArg) {
    const season = seasonArg ? Number(seasonArg) : new Date().getFullYear();
    console.log(`Syncing CBB teams for season ${season}...`);
  
    const url = new URL('https://api.collegebasketballdata.com/teams');
    // year is optional in the API; safe to send
    url.searchParams.set('year', season);
  
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${CFBD_API_KEY}` },
    });
  
    if (!res.ok) {
      throw new Error(`CBB /teams ${res.status}: ${await res.text()}`);
    }
  
    const teams = await res.json();
    console.log(`Got ${teams.length} teams from API`);
  
    const nowIso = new Date().toISOString();
  
    const rows = teams.map((t) => {
      const team_id = pick(t, ['id', 'teamId']);
      const team = pick(t, ['school', 'team', 'name']);
      const abbreviation = pick(t, ['abbreviation', 'abbrev']);
      const conference = pick(t, ['conference']);
      const division = pick(t, ['division']);
  
      if (!team_id || !team) {
        console.warn('Skipping team with missing id/name:', t);
        return null;
      }
  
      return {
        team_id,
        team,
        abbreviation,
        conference,
        division,
        data: t,
        updated_at: nowIso,
      };
    }).filter(Boolean);
  
    if (!rows.length) {
      console.log('Nothing to upsert.');
      return;
    }
  
    const { error, count } = await supabase
      .from('teams')
      .upsert(rows, {
        onConflict: 'team_id',
        ignoreDuplicates: false,
        count: 'exact',
      });
  
    if (error) throw error;
    console.log(`✅ Upserted ${count} rows into cbb.teams.`);
  }
  
  // CLI entry
  if (import.meta.url === `file://${process.argv[1]}`) {
    run(process.argv[2]).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  }
  