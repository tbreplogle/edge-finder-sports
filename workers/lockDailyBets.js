/*  Lock today’s ≥7-confidence bets  (market ML, team name, stake/to_win) */
import { supabase, testConnection } from './lib/supabaseClient.js';

function todayCT() {
  const ct = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
  );
  return ct.toISOString().slice(0, 10);
}

/* convert ML → stake needed to win exactly 100 */
function stakeForWin100(ml) {
  return ml < 0
    ? Math.abs(ml)                        // -110 -> 110
    : +(10000 / ml).toFixed(2);           // +120 -> 83.33
}

async function lockDailyBets() {
  if (!(await testConnection())) throw new Error('DB connection failed');
  const today = todayCT();

  /* 1) predictions for today — include market MLs & team names */
  const { data: preds, error: predErr } = await supabase
    .from('mlb_predictions_with_market')
    .select(`
      matchup_id,
      game_time_ct,
      home_confidence,
      away_confidence,
      home_market_ml,
      away_market_ml,
      home_team,
      away_team,
      pred_total_runs
    `)
    .gte('game_time_ct', `${today}T00:00:00-05:00`)
    .lt ('game_time_ct', `${today}T23:59:59-05:00`);

  if (predErr) throw predErr;

  /* 2) meta for team IDs */
  const { data: metas, error: metaErr } = await supabase
    .from('mlb_matchups')
    .select('matchup_id, home_team_id, away_team_id')
    .eq('game_date', today);
  if (metaErr) throw metaErr;

  const metaById = Object.fromEntries(metas.map(m => [m.matchup_id, m]));

  /* 3) build bets */
  const bets = preds
    .filter(r =>
      Math.max(r.home_confidence ?? 0, r.away_confidence ?? 0) >= 7 &&
      r.home_market_ml != null && r.away_market_ml != null &&
      metaById[r.matchup_id]
    )
    .map(r => {
      const meta     = metaById[r.matchup_id];
      const betHome  = (r.home_confidence ?? 0) >= (r.away_confidence ?? 0);

      const moneyline = betHome ? r.home_market_ml : r.away_market_ml;
      const team_id   = betHome ? meta.home_team_id : meta.away_team_id;
      const team_name = betHome ? r.home_team       : r.away_team;
      const stake     = stakeForWin100(moneyline);

      return {
        matchup_id : r.matchup_id,
        game_date  : today,
        team_id,
        team_name,
        confidence : Math.max(r.home_confidence, r.away_confidence),
        moneyline,
        stake,
        to_win     : 100,
        pred_total_runs : r.pred_total_runs


      };
    });

  console.log(`Locking ${bets.length} bets for ${today}`);

  if (!bets.length) return;

  const { error: upErr } = await supabase
    .from('mlb_daily_bets')
    .upsert(bets, { onConflict: 'matchup_id' });

  if (upErr) throw upErr;
  console.log('✅ Bets locked.');
}

if (import.meta.url.endsWith('lockDailyBets.js')) {
  lockDailyBets()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
