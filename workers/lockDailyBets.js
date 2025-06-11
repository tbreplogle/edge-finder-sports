/* Lock today's ≥7-confidence edges at noon CT
   -----------------------------------------------------------*/
   import { supabase, testConnection } from './lib/supabaseClient.js';

   function todayCT() {
     const ct = new Date(
       new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
     );
     return ct.toISOString().slice(0, 10);
   }
   
   async function lockDailyBets() {
     if (!(await testConnection())) throw new Error('DB connection failed');
     const today = todayCT();
   
     /* 1) pull today’s predictions + matchup meta in one query */
     const { data, error } = await supabase
       .from('mlb_predictions_with_market')
       .select(`
         matchup_id,
         game_date,
         home_confidence,
         away_confidence,
         home_pred_ml,
         away_pred_ml,
         mlb_matchups!inner(home_team_id, away_team_id)
       `)
       .eq('game_date', today);
   
     if (error) throw error;
   
     /* 2) filter ≥7-confidence and shape rows */
     const bets = data
       .filter(r => Math.max(r.home_confidence ?? 0, r.away_confidence ?? 0) >= 7)
       .map(r => {
         const betHome = (r.home_confidence ?? 0) >= (r.away_confidence ?? 0);
         return {
           matchup_id     : r.matchup_id,
           game_date      : today,
           chosen_team_id : betHome ? r.mlb_matchups.home_team_id
                                    : r.mlb_matchups.away_team_id,
           confidence     : Math.max(r.home_confidence, r.away_confidence),
           moneyline      : betHome ? r.home_pred_ml : r.away_pred_ml,
           stake          : 100
         };
       });
   
     if (!bets.length) {
       console.log('🔸 No ≥7-confidence edges to lock today.');
       return;
     }
   
     /* 3) upsert – safe to re-run */
     const { error: upErr } = await supabase
       .from('mlb_daily_bets')
       .upsert(bets, { onConflict: 'matchup_id' });
   
     if (upErr) throw upErr;
     console.log(`✅ Locked ${bets.length} bets for ${today}`);
   }
   
   if (import.meta.url.endsWith('lockDailyBets.js')) {
     lockDailyBets().then(() => process.exit(0)).catch(err => {
       console.error(err); process.exit(1);
     });
   }
   