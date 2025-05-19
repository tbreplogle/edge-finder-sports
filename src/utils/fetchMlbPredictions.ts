import { supabase } from "@/integrations/supabase/client";

/* --------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* --------------------------------------------------------------------------- */
const mlToPct = (ml: number | null): number | null =>
  ml == null ? null
    : ml > 0
    ? 100 / (ml + 100)
    : Math.abs(ml) / (Math.abs(ml) + 100);

const pctToMl = (p: number | null): number | null =>
  p == null
    ? null
    : p > 0.5
    ? -Math.round((p / (1 - p)) * 100)
    :  Math.round(((1 - p) / p) * 100);

/* --------------------------------------------------------------------------- */
/* Types                                                                       */
/* --------------------------------------------------------------------------- */
export interface ProcessedMlbPrediction {
  matchup_id:      string;
  game_id:         string;
  home_team:       string;
  away_team:       string;
  game_time_ct:    string;

  home_market_ml:  number | null;
  away_market_ml:  number | null;
  home_market_pct: number | null;
  away_market_pct: number | null;

  home_pred_pct:   number | null;
  away_pred_pct:   number | null;
  home_pred_ml:    number | null;
  away_pred_ml:    number | null;

  home_edge_pct:   number | null;
  away_edge_pct:   number | null;

  home_pitcher:    string | null;
  away_pitcher:    string | null;
}

/* --------------------------------------------------------------------------- */
/* Fetcher                                                                     */
/* --------------------------------------------------------------------------- */
export async function fetchMlbPredictions(): Promise<ProcessedMlbPrediction[]> {
  /*  Select from the **view** (not RPC)  */
  const { data, error } = await supabase
    .from("mlb_predictions_with_market")
    .select("*");

  if (error) throw new Error(error.message);

  /*  Convert / enrich ----------------------------------------------------- */
  return (data as any[]).map((r) => {
    const homeMarketPct = r.home_market_pct ?? mlToPct(r.home_market_ml);
    const awayMarketPct = r.away_market_pct ?? mlToPct(r.away_market_ml);

    const homePredPct  = r.home_pred_pct ?? null;
    const awayPredPct  = r.away_pred_pct ?? null;

    return {
      matchup_id : r.matchup_id,
      game_id    : r.game_id,
      home_team  : r.home_team,
      away_team  : r.away_team,
      game_time_ct: r.game_time_ct,

      home_market_ml : r.home_market_ml,
      away_market_ml : r.away_market_ml,
      home_market_pct: homeMarketPct,
      away_market_pct: awayMarketPct,

      home_pred_pct  : homePredPct,
      away_pred_pct  : awayPredPct,
      home_pred_ml   : pctToMl(homePredPct),
      away_pred_ml   : pctToMl(awayPredPct),

      home_edge_pct:
        homePredPct != null && homeMarketPct != null
          ? homePredPct - homeMarketPct
          : null,
      away_edge_pct:
        awayPredPct != null && awayMarketPct != null
          ? awayPredPct - awayMarketPct
          : null,

      home_pitcher: r.home_pitcher ?? null,
      away_pitcher: r.away_pitcher ?? null,
    } as ProcessedMlbPrediction;
  });
}
