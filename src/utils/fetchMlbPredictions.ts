import { supabase } from "@/integrations/supabase/client";

/* ---------- helpers ---------------------------------------------------- */
const mlToPct = (raw: number | null): number | null => {
  const ml = raw == null ? null : parseFloat(String(raw));
  if (ml == null || Number.isNaN(ml)) return null;
  return ml > 0
    ? 100 / (ml + 100)
    : Math.abs(ml) / (Math.abs(ml) + 100);
};

const pctToMl = (p: number | null): number | null =>
  p == null
    ? null
    : p >= 0.5
    ? -Math.round((p / (1 - p)) * 100)
    :  Math.round(((1 - p) / p) * 100);

/* ---------- type ------------------------------------------------------- */
export interface ProcessedMlbPrediction {
  matchup_id : string;
  game_id    : string;
  home_team  : string;
  away_team  : string;
  game_time  : string;               // now plain timestamp (no TZ)

  home_market_ml  : number | null;
  away_market_ml  : number | null;
  home_market_pct : number | null;
  away_market_pct : number | null;

  home_pred_pct   : number | null;
  away_pred_pct   : number | null;
  home_pred_ml    : number | null;
  away_pred_ml    : number | null;

  home_edge_pct   : number | null;
  away_edge_pct   : number | null;

  home_pitcher    : string | null;
  away_pitcher    : string | null;
}

/* ---------- fetcher ---------------------------------------------------- */
export async function fetchMlbPredictions(): Promise<ProcessedMlbPrediction[]> {
  const { data, error } = await supabase.rpc("mlb_predictions_with_market");
  if (error) throw new Error(error.message);

  return (data as any[]).map(r => {
    /* money-lines arrive as TEXT → force number */
    const hML = r.home_market_ml != null ? +r.home_market_ml : null;
    const aML = r.away_market_ml != null ? +r.away_market_ml : null;

    const hPct = mlToPct(hML);
    const aPct = mlToPct(aML);

    const hPredPct = r.home_pred_pct != null ? +r.home_pred_pct : null;
    const aPredPct = r.away_pred_pct != null ? +r.away_pred_pct : null;

    return {
      matchup_id : r.matchup_id,
      game_id    : r.game_id,
      home_team  : r.home_team,
      away_team  : r.away_team,
      game_time  : r.game_time_ct,             // plain timestamp

      home_market_ml  : hML,
      away_market_ml  : aML,
      home_market_pct : hPct,
      away_market_pct : aPct,

      home_pred_pct : hPredPct,
      away_pred_pct : aPredPct,
      home_pred_ml  : pctToMl(hPredPct),
      away_pred_ml  : pctToMl(aPredPct),

      home_edge_pct :
        hPredPct != null && hPct != null ? +(hPredPct - hPct).toFixed(4) : null,
      away_edge_pct :
        aPredPct != null && aPct != null ? +(aPredPct - aPct).toFixed(4) : null,

      home_pitcher : r.home_pitcher ?? null,
      away_pitcher : r.away_pitcher ?? null,
    };
  });
}
