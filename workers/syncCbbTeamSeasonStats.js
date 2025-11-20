// workers/syncCbbTeamSeasonStats.js
// ----------------------------------------------
// Pull CBB team season stats from CollegeBasketballData
// and upsert into cbb.team_season_stats.
// ----------------------------------------------

// optional dotenv for local dev
try {
    const { config } = await import('dotenv');
    config();
  } catch {
    console.log('dotenv not installed – skipping .env load');
  }
  
  import fetch from 'node-fetch';
  import { createClient } from '@supabase/supabase-js';
  
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CFBD_API_KEY, CBB_SEASON } = process.env;
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CFBD_API_KEY) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / CFBD_API_KEY');
    process.exit(1);
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    db: { schema: 'cbb' },
  });
  
  // helper to pick first non-nullish field
  const pick = (obj, keys) => {
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return null;
  };
  
  async function getTeamMap() {
    const { data, error } = await supabase
      .from('teams')
      .select('team_id, team');
  
    if (error) throw error;
    return Object.fromEntries(data.map((r) => [r.team, r.team_id]));
  }
  
  async function run(seasonArg) {
    let season;
    if (seasonArg) {
      season = Number(seasonArg);
    } else if (CBB_SEASON) {
      season = Number(CBB_SEASON);
    } else {
      season = 2026;
    }
  
    console.log(`Syncing CBB team season stats for season ${season}...`);
  
    const url = new URL('https://api.collegebasketballdata.com/stats/team/season');
    url.searchParams.set('season', season);           // REQUIRED by API
    url.searchParams.set('season_type', 'regular');   // optional but recommended
  
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${CFBD_API_KEY}` },
    });
  
    if (!res.ok) {
      throw new Error(`CBBD /stats/team/season ${res.status}: ${await res.text()}`);
    }
  
    const stats = await res.json();
    console.log(`Got ${stats.length} team season stat rows from API`);
  
    const teamMap = await getTeamMap();
    const nowIso = new Date().toISOString();
  
    const rows = stats.flatMap((s) => {
      const teamName = pick(s, ['team', 'school', 'name']);
      const teamId = teamMap[teamName];
  
      if (!teamId) {
        console.warn(`⚠️ Unknown team "${teamName}" – skipping`);
        return [];
      }
  
      const conference = pick(s, ['conference']);
      const pace = pick(s, ['pace']);
  
      // Try both CBB-style (teamStats/opponentStats) and CFBD-style (offense/defense)
      const off = s.teamStats ?? s.offense ?? {};
      const def = s.opponentStats ?? s.defense ?? {};
  
      const off4 = off.fourFactors ?? {};
      const def4 = def.fourFactors ?? {};
  
      return {
        season,
        team_id: teamId,
        conference: conference ?? null,
  
        pace: pace ?? null,
  
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
  
        updated_at: nowIso,
      };
    });
  
    if (!rows.length) {
      console.log('Nothing to upsert.');
      return;
    }
  
    console.log('Sample row:', rows[0]);
  
    const { error, count } = await supabase
      .from('team_season_stats')
      .upsert(rows, {
        onConflict: 'season,team_id',
        ignoreDuplicates: false,
        count: 'exact',
      });
  
    if (error) throw error;
    console.log(`✅ Upserted ${count} rows into cbb.team_season_stats.`);
  }
  
  // CLI entry
  if (import.meta.url === `file://${process.argv[1]}`) {
    run(process.argv[2]).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  }
  