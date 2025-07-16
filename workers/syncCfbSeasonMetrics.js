// workers/syncCfbSeasonMetrics.js
// ────────────────────────────────────────────────────────────────
// Pull CollegeFootballData advanced season stats and upsert them
// into the cfb.team_season_metrics table (one row per team/season).
// Runs locally or in GitHub Actions.
//
// • Uses dotenv locally (optional) – ignored on CI.
// • Supabase client defaults to the `cfb` schema, so we reference
//   plain table names: "teams", "team_season_metrics".
// ────────────────────────────────────────────────────────────────

// ── optional .env load for local dev ────────────────────────────
try {
    const { config } = await import('dotenv');
    config();
  } catch {
    console.log('dotenv not installed – skipping .env load');
  }
  
  // ── deps ────────────────────────────────────────────────────────
  import fetch from 'node-fetch';
  import { createClient } from '@supabase/supabase-js';
  
  // ── env vars ────────────────────────────────────────────────────
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CFBD_API_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CFBD_API_KEY) {
    console.error('Missing one of SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / CFBD_API_KEY');
    process.exit(1);
  }
  
  // Supabase client – default schema = cfb
  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false },
      db:   { schema: 'cfb' }           // all queries hit cfb.*
    }
  );
  
  // ── helper: map team name → team_id ─────────────────────────────
  async function getTeamMap() {
    const { data, error } = await supabase
      .from('teams')                    // table name only
      .select('team_id, team_name');
    if (error) throw error;
    return Object.fromEntries(data.map(r => [r.team_name, r.team_id]));
  }
  
  // ── pull API + upsert ──────────────────────────────────────────
  async function run(season = 2024) {
    const url = `https://api.collegefootballdata.com/stats/season/advanced?year=${season}&excludeGarbageTime=true&startWeek=1`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${CFBD_API_KEY}` }
    });
    if (!res.ok) throw new Error(`CFBD ${res.status}: ${await res.text()}`);
    const stats = await res.json();
  

      /* ── NEW: fetch per‑team PPA (EPA/play) metrics ─────────────────────── */
      const ppaUrl = `https://api.collegefootballdata.com/ppa/teams?`
                    + `year=${season}&excludeGarbageTime=true`;    // no extra params needed

      const ppaRes = await fetch(ppaUrl, {
        headers: { Authorization: `Bearer ${CFBD_API_KEY}` },
        Accept: 'application/json'
      });
      if (!ppaRes.ok) {
        throw new Error(`CFBD PPA ${ppaRes.status}: ${await ppaRes.text()}`);
      }
      const ppa = await ppaRes.json();
      /* Map: team name → { offPassPPA, defPassPPA } */
      const ppaMap = Object.fromEntries(
        ppa.map(p => [
          p.team,
          {
            off: p.offPassing  ?? p.off_passing,   // API may camel‑ or snake‑case
            def: p.defPassing  ?? p.def_passing
          }
        ])
      );

    const teamMap = await getTeamMap();
  
    const rows = stats.flatMap(s => {
      const id = teamMap[s.team];
      if (!id) {
        console.warn(`⚠️  Unknown team "${s.team}" – skipping`);
        return [];
      }
      const pass = ppaMap[s.team] || {};
      return {
        season,
        team_id:              id,
        off_ppo:              s.offense.pointsPerOpportunity,
        def_ppo:              s.defense.pointsPerOpportunity,
        off_success:          s.offense.successRate,
        def_success:          s.defense.successRate,
        off_explosiveness:    s.offense.explosiveness,
        def_explosiveness:    s.defense.explosiveness,
        off_plays:            s.offense.plays,
        def_plays:            s.defense.plays,
        off_line_yards_total: s.offense.lineYardsTotal,
        def_line_yards_total: s.defense.lineYardsTotal,
        off_fp_avg_start:     s.offense.fieldPosition.averageStart,
        def_fp_avg_start:     s.defense.fieldPosition.averageStart,
        off_pass_ppa:         pass.off ?? null,
        def_pass_ppa:         pass.def ?? null,
        updated_at:           new Date().toISOString()
      };
    });
  
    if (!rows.length) {
      console.log('Nothing to upsert.');
      return;
    }
  
    const { error, count } = await supabase
      .from('team_season_metrics')      // table name only
      .upsert(rows, { ignoreDuplicates: false, count: 'exact' });
  
    if (error) throw error;
    console.log(`✅ Upserted ${count} season-metrics rows.`);
  }
  
  // ── CLI execution guard ─────────────────────────────────────────
  if (import.meta.url === `file://${process.argv[1]}`) {
    run().catch(err => {
      console.error(err);
      process.exit(1);
    });
  }
  