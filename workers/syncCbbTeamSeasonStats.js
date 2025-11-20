// workers/syncCbbTeamSeasonStats.js
// ----------------------------------------------
// Pull CBB team season stats from CBBD API and
// upsert into cbb.team_season_stats.
// ----------------------------------------------

try {
    const { config } = await import('dotenv');
    config();
  } catch {
    console.log('dotenv not installed – skipping .env load');
  }
  
  import fetch from 'node-fetch';
  import { createClient } from '@supabase/supabase-js';
  
  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    CFBD_API_KEY, // same key works for CBB API
  } = process.env;
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CFBD_API_KEY) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / CFBD_API_KEY');
    process.exit(1);
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    db:   { schema: 'cbb' },
  });
  
  // map team name -> team_id
  async function getTeamMap() {
    const { data, error } = await supabase
      .from('teams')
      .select('team_id, team');
  
    if (error) throw error;
    return Object.fromEntries(data.map(r => [r.team, r.team_id]));
  }
  
  async function run(season = 2026) {
    // NOTE: adjust query params (seasonType, etc.) to match CBB API docs
    const url =
      `https://api.collegebasketballdata.com/stats/team/season` +
      `?year=${season}`;
  
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${CFBD_API_KEY}`,
      },
    });
  
    if (!res.ok) {
      throw new Error(`CBBD /stats/team/season ${res.status}: ${await res.text()}`);
    }
  
    const stats = await res.json();
    const teamMap = await getTeamMap();
  
    const rows = stats.flatMap(s => {
      const teamId = teamMap[s.team];
      if (!teamId) {
        console.warn(`⚠️ Unknown team "${s.team}" – skipping`);
        return [];
      }
  
      const off = s.teamStats ?? {};
      const def = s.opponentStats ?? {};
      const off4 = (off.fourFactors ?? {});
      const def4 = (def.fourFactors ?? {});
  
      return {
        season,
        team_id: teamId,
        conference: s.conference ?? null,
  
        pace: s.pace ?? null,
  
        team_rating: off.rating ?? null,
        opp_rating: def.rating ?? null,
  
        efg_off: off4.effectiveFieldGoalPct ?? null,
        efg_def: def4.effectiveFieldGoalPct ?? null,
  
        orb_off: off4.offensiveReboundPct ?? null,
        orb_def: def4.offensiveReboundPct ?? null,
  
        tov_ratio_off: off4.turnoverRatio ?? null,
        tov_ratio_def: def4.turnoverRatio ?? null,
  
        ftr_off: off4.freeThrowRate ?? null,
        ftr_def: def4.freeThrowRate ?? null,
  
        games: s.games ?? null,
        wins: s.wins ?? null,
        losses: s.losses ?? null,
  
        updated_at: new Date().toISOString(),
      };
    });
  
    if (!rows.length) {
      console.log('Nothing to upsert.');
      return;
    }
  
    console.log('Sample row:', rows[0]);
  
    const { error, count } = await supabase
      .from('team_season_stats')
      .upsert(rows, { ignoreDuplicates: false, count: 'exact' });
  
    if (error) throw error;
    console.log(`✅ Upserted ${count} rows into cbb.team_season_stats.`);
  }
  
  // CLI guard
  if (import.meta.url === `file://${process.argv[1]}`) {
    run().catch(err => {
      console.error(err);
      process.exit(1);
    });
  }
  