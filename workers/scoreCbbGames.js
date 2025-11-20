// workers/scoreCbbGames.js
// ------------------------
// Read feature view for today's (or upcoming) games,
// apply the linear spread model + logistic win prob,
// upsert into cbb.model_predictions.

try {
    const { config } = await import('dotenv');
    config();
  } catch {
    console.log('dotenv not installed – skipping .env load');
  }
  
  import { createClient } from '@supabase/supabase-js';
  
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    db: { schema: 'cbb' },
  });
  
  // ------- model coefficients (from your notebook) -------
  
  // Spread model: margin = b0 + Σ bi * xi
  const B0 = 6.932410483920057;
  
  const COEFFS = {
    net_rating_diff:    0.235,
    net_rating_diff_std: 0.072,
    efg_margin_diff:    0.692,
    orb_margin_diff:    0.334,
    tov_margin_diff:    4.885,  // this is your "alt" version (home TOV advantage)
    ftr_margin_diff:    0.084,
    is_neutral:        -3.720,
    is_conference_game: -4.213,
  };
  
  // Logistic calibration: predicted margin -> P(home win)
  const WIN_B0 = 0.025883855114500698;
  const WIN_B1 = 0.18176881037937292;
  
  function predictMargin(row) {
    let m = B0;
    for (const [name, w] of Object.entries(COEFFS)) {
      const x = Number(row[name] ?? 0);
      m += w * x;
    }
    return m;
  }
  
  function marginToWinProb(margin) {
    const logit = WIN_B0 + WIN_B1 * margin;
    return 1 / (1 + Math.exp(-logit));
  }
  
  async function run(seasonArg) {
    const season = seasonArg ? Number(seasonArg) : new Date().getFullseason();
    const today = new Date().toISOString().slice(0, 10);
  
    console.log(`Scoring CBB games for season ${season}, date >= ${today}...`);
  
    // You can tighten this filter however you like (e.g., only today)
    const { data: games, error } = await supabase
      .from('v_cbb_spread_features_live')
      .select('*')
      .eq('season', season)
      .gte('game_date', today);
  
    if (error) throw error;
  
    if (!games.length) {
      console.log('No games found to score.');
      return;
    }
  
    console.log(`Scoring ${games.length} games...`);
  
    const nowIso = new Date().toISOString();
  
    const rows = games.map((g) => {
      const predicted_margin = predictMargin(g);
      const home_win_prob = marginToWinProb(predicted_margin);
      const vegas_spread = g.vegas_spread ?? null;
      const edge_spread =
        vegas_spread == null ? null : predicted_margin - Number(vegas_spread);
  
      return {
        season: g.season,
        game_id: g.game_id,
        game_date: g.game_date,
        home_team_id: g.home_team_id,
        away_team_id: g.away_team_id,
        predicted_margin,
        home_win_prob,
        vegas_spread,
        edge_spread,
        created_at: nowIso,
        updated_at: nowIso,
      };
    });
  
    const { error: upsertError, count } = await supabase
      .from('model_predictions')
      .upsert(rows, {
        onConflict: 'game_id',
        ignoreDuplicates: false,
        count: 'exact',
      });
  
    if (upsertError) throw upsertError;
  
    console.log(`✅ Upserted ${count} rows into cbb.model_predictions.`);
  }
  
  // CLI entry
  if (import.meta.url === `file://${process.argv[1]}`) {
    run(process.argv[2]).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  }
  