// workers/syncCfbATestTeamSeasonMetrics.js
// ────────────────────────────────────────────────────────────────
// Pull CFBD advanced season stats and upsert them into
// cfb.a_test_team_season_metrics (one row per team/season).
// Uses all features needed for the 2025 rating_raw formula.
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
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    db:   { schema: 'cfb' },
  });
  
  // ── helper: map team name → team_id ─────────────────────────────
  async function getTeamMap() {
    const { data, error } = await supabase
      .from('teams')
      .select('team_id, team_name');
  
    if (error) throw error;
    return Object.fromEntries(data.map(r => [r.team_name, r.team_id]));
  }
  
  // ── pull API + upsert ──────────────────────────────────────────
  async function run(season = 2025) {
    const url =
      `https://api.collegefootballdata.com/stats/season/advanced` +
      `?year=${season}&excludeGarbageTime=true&startWeek=1`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${CFBD_API_KEY}` },
    });
    if (!res.ok) throw new Error(`CFBD ${res.status}: ${await res.text()}`);
    const stats = await res.json();
  
    const teamMap = await getTeamMap();
  
    const rows = stats.flatMap(s => {
      const id = teamMap[s.team];
      if (!id) {
        console.warn(`⚠️  Unknown team "${s.team}" – skipping`);
        return [];
      }
  
      const off = s.offense ?? {};
      const def = s.defense ?? {};
  
      const offStd  = off.standardDowns ?? {};
      const defStd  = def.standardDowns ?? {};
      const offPD   = off.passingDowns ?? {};
      const defPD   = def.passingDowns ?? {};
      const offRush = off.rushingPlays ?? {};
      const defRush = def.rushingPlays ?? {};
      const offPass = off.passingPlays ?? {};
      const defPass = def.passingPlays ?? {};
  
      return {
        season,
        team_id: id,
  
        // offense rushing / passing / std / PD / line / open / second-level
        off_rush_success:         offRush.successRate ?? null,
        off_ppa:                  off.ppa ?? null,
        off_pass_success:         offPass.successRate ?? null,
        off_success:              off.successRate ?? null,
        off_explosiveness:        off.explosiveness ?? null,
        off_total_ppa:            off.totalPPA ?? null,
        off_power_success:        off.powerSuccess ?? null,
        off_stuff_rate:           off.stuffRate ?? null,
        off_plays:                off.plays ?? null,
  
        off_line_yards:           off.lineYards ?? null,
        off_line_yards_total:     off.lineYardsTotal ?? null,
        off_second_level_yards:   off.secondLevelYards ?? null,
        off_open_field_yards:     off.openFieldYards ?? null,
  
        off_sd_ppa:               offStd.ppa ?? null,
        off_sd_success:           offStd.successRate ?? null,
        off_sd_explosiveness:     offStd.explosiveness ?? null,
  
        off_pd_ppa:               offPD.ppa ?? null,
        off_pd_success:           offPD.successRate ?? null,
        off_pd_explosiveness:     offPD.explosiveness ?? null,
  
        off_rush_ppa:             offRush.ppa ?? null,
        off_rush_total_ppa:       offRush.totalPPA ?? null,
        off_rush_explosiveness:   offRush.explosiveness ?? null,
  
        off_pass_ppa:             offPass.ppa ?? null,
        off_pass_total_ppa:       offPass.totalPPA ?? null,
        off_pass_explosiveness:   offPass.explosiveness ?? null,
  
        // defense side mirrors
        def_success:              def.successRate ?? null,
        def_ppa:                  def.ppa ?? null,
        def_explosiveness:        def.explosiveness ?? null,
        def_total_ppa:            def.totalPPA ?? null,
        def_power_success:        def.powerSuccess ?? null,
        def_stuff_rate:           def.stuffRate ?? null,
        def_plays:                def.plays ?? null,
        def_drives:               def.drives ?? null,
  
        def_line_yards:           def.lineYards ?? null,
        def_line_yards_total:     def.lineYardsTotal ?? null,
        def_second_level_yards:   def.secondLevelYards ?? null,
        def_second_level_yards_total: def.secondLevelYardsTotal ?? null,
        def_open_field_yards:     def.openFieldYards ?? null,
        def_open_field_yards_total: def.openFieldYardsTotal ?? null,
  
        def_sd_ppa:               defStd.ppa ?? null,
        def_sd_success:           defStd.successRate ?? null,
        def_sd_explosiveness:     defStd.explosiveness ?? null,
  
        def_pd_ppa:               defPD.ppa ?? null,
        def_pd_success:           defPD.successRate ?? null,
  
        def_rush_ppa:             defRush.ppa ?? null,
        def_rush_total_ppa:       defRush.totalPPA ?? null,
        def_rush_success:         defRush.successRate ?? null,
  
        def_pass_ppa:             defPass.ppa ?? null,
        def_pass_total_ppa:       defPass.totalPPA ?? null,
        def_pass_success:         defPass.successRate ?? null,
        def_pass_explosiveness:   defPass.explosiveness ?? null,
  
        updated_at: new Date().toISOString(),
      };
    });
  
    if (!rows.length) {
      console.log('Nothing to upsert.');
      return;
    }
  
    console.log('Sample row:', rows[0]);
  
    const { error, count } = await supabase
      .from('a_test_team_season_metrics')
      .upsert(rows, { ignoreDuplicates: false, count: 'exact' });
  
    if (error) throw error;
    console.log(`✅ Upserted ${count} rows into a_test_team_season_metrics.`);
  }
  
  // ── CLI execution guard ─────────────────────────────────────────
  if (import.meta.url === `file://${process.argv[1]}`) {
    run().catch(err => {
      console.error(err);
      process.exit(1);
    });
  }
  