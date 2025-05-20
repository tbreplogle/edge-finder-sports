// src/utils/fetchMlbPredictions.ts
import { supabase } from "@/integrations/supabase/client";

/* ---------------------------------------------------------------------------
   Types
---------------------------------------------------------------------------- */
export interface ProcessedMlbPrediction {
  matchup_id:    string;
  game_id:       string;
  home_team:     string;
  away_team:     string;
  game_time_ct:  string;

  home_market_ml:  number | null;
  away_market_ml:  number | null;
  home_market_pct: number | null;
  away_market_pct: number | null;

  home_pred_pct: number | null;
  away_pred_pct: number | null;
  home_pred_ml:  number | null;
  away_pred_ml:  number | null;

  home_edge_pct: number | null;
  away_edge_pct: number | null;

  home_pitcher: string | null;
  away_pitcher: string | null;
}

/* ---------------------------------------------------------------------------
   Fetcher
---------------------------------------------------------------------------- */
export async function fetchMlbPredictions(): Promise<ProcessedMlbPrediction[]> {
  // Call the RPC that already pivots mlb_predictions + mlb_market_odds + pitching_matchups
  const { data, error } = await supabase.rpc(
    "mlb_predictions_with_market"
  );

  if (error) {
    throw new Error(error.message);
  }
  if (!data) return [];

  // The RPC returns exactly the 1-row-per-game shape we need:
  return (data as any[]).map((r) => ({
    matchup_id:    r.matchup_id,
    game_id:       r.game_id,
    home_team:     r.home_team,
    away_team:     r.away_team,
    game_time_ct:  r.game_time_ct,

    home_market_ml:  r.home_market_ml,
    away_market_ml:  r.away_market_ml,
    home_market_pct: r.home_market_pct,
    away_market_pct: r.away_market_pct,

    home_pred_pct: r.home_pred_pct,
    away_pred_pct: r.away_pred_pct,
    home_pred_ml:  r.home_pred_ml,
    away_pred_ml:  r.away_pred_ml,

    home_edge_pct: r.home_edge_pct,
    away_edge_pct: r.away_edge_pct,

    home_pitcher: r.home_pitcher,
    away_pitcher: r.away_pitcher,
  }));
}
