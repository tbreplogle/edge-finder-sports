/* ──────────────────────────────────────────────────────────────
   1) Snapshot the current state of the view
   ──────────────────────────────────────────────────────────────*/
INSERT INTO public.mlb_predictions_with_market_history (
    snapshot_dts,
    matchup_id, game_id, game_time_ct,
    home_team, away_team,
    home_market_ml, away_market_ml,
    home_market_pct, away_market_pct,
    home_pred_ml, away_pred_ml,
    home_pred_pct, away_pred_pct,
    home_edge_pct, away_edge_pct,
    pred_total,
    home_pitcher, away_pitcher,
    away_ticket_pct, home_ticket_pct,
    home_confidence, away_confidence
)
SELECT
    NOW() AS snapshot_dts,
    pm.*
FROM   public.mlb_predictions_with_market AS pm
ON CONFLICT (snapshot_dts, matchup_id)      -- avoids exact-timestamp duplicates
DO NOTHING;


/* ──────────────────────────────────────────────────────────────
   2) Truncate staging tables (view is unaffected; history is kept)
   ──────────────────────────────────────────────────────────────*/
TRUNCATE TABLE
    public.mlb_team_hitting_stats,
    public.mlb_predictions,
    public.mlb_matchups,
    public.mlb_market_odds,
    public.pitching_matchups;
