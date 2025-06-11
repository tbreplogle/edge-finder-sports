import { supabase, testConnection } from './lib/supabaseClient.js';

/* Today in Central Time (YYYY-MM-DD) */
function todayCT() {
  const ct = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
  );
  return ct.toISOString().slice(0, 10);
}

async function lockBets() {
  if (!(await testConnection())) throw new Error('DB connection failed');
  const today = todayCT();

  /* 1 ─ Fetch today’s predictions with matchup meta */
  const { data: rows, error } = await supabase
    .from('mlb_predictions_with_market')
    .select(`
      matchup_id,
      game_time_ct,
      home_confidence,
      away_confidence,
      home_pred_ml,
      away_pred_ml,
      mlb_matchups!inner(home_team_id, away_team_id)
    `)
    .filter('game_time_ct', 'gte', `${today}T00:00:00-05:00`)  // 00:00 CT
    .filter('game_time_ct', 'lt' , `${today}T23:59:59-05:00`); // 23:59 CT

  if (error) throw error;
  console.log(`Pulled ${rows.length} prediction rows for ${today}`);

  /* 2 ─ Keep ≥7-confidence rows & build bet objects */
  const bets = rows
    .filter(r => Math.max(r.home_confidence ?? 0, r.away_confidence ?? 0) >= 7)
    .filter(r => r.home_pred_ml != null && r.away_pred_ml != null)
    .map(r => {
      const betHome = (r.home_confidence ?? 0) >= (r.away_confidence ?? 0);
      return {
        matchup_id     : r.matchup_id,
        game_date      : today,
        chosen_team_id : betHome
          ? r.mlb_matchups.home_team_id
          : r.mlb_matchups.away_team_id,
        confidence     : Math.max(r.home_confidence, r.away_confidence),
        moneyline      : betHome ? r.home_pred_ml : r.away_pred_ml,
        stake          : 100
      };
    });

  console.log(`Locking ${bets.length} bets (≥7 confidence)`);

  if (!bets.length) return;

  /* 3 ─ Upsert into mlb_daily_bets */
  const { error: upErr } = await supabase
    .from('mlb_daily_bets')
    .upsert(bets, { onConflict: 'matchup_id' });

  if (upErr) throw upErr;
  console.log('✅ Bets locked.');
}

if (import.meta.url.endsWith('lockDailyBets.js')) {
  lockBets().then(() => process.exit(0)).catch(e => {
    console.error(e); process.exit(1);
  });
}
