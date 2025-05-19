// src/utils/fetchMlbPredictions.ts
import { supabase } from "@/integrations/supabase/client";

/* utilities -------------------------------------------------- */
const mlToPct = (ml: number | null): number | null =>
  ml == null ? null : ml > 0 ? 100 / (ml + 100) : Math.abs(ml) / (Math.abs(ml) + 100);

const pctToMl = (p: number | null): number | null =>
  p == null ? null : p > 0.5 ? -Math.round((p / (1 - p)) * 100) : Math.round(((1 - p) / p) * 100);

/* exported client-side shape --------------------------------- */
export interface ProcessedMlbPrediction {
  matchup_id: string;
  game_id: string;
  game_time_ct: string;

  home_team: string;
  away_team: string;

  home_market_ml: number | null;
  away_market_ml: number | null;
  home_market_pct: number | null;
  away_market_pct: number | null;

  home_pred_ml: number | null;
  away_pred_ml: number | null;
  home_pred_pct: number | null;
  away_pred_pct: number | null;

  home_edge_pct: number | null;
  away_edge_pct: number | null;

  home_pitcher: string | null;
  away_pitcher: string | null;
}

/* main fetcher ----------------------------------------------- */
export async function fetchMlbPredictions(): Promise<ProcessedMlbPrediction[]> {
  /* 1. call the **view** we created earlier — no filters, we’ll sort client-side */
  const { data, error } = await supabase
    .from("mlb_predictions_with_market")      // <-- view, not raw tables
    .select(`
      matchup_id,
      game_id,
      game_time_ct,
      home_team,
      away_team,

      home_ml:home_market_ml,
      away_ml:away_market_ml,

      home_pred_ml,
      away_pred_ml,
      home_pred_pct,
      away_pred_pct,

      home_pitcher,
      away_pitcher
    `);

  if (error) throw new Error(error.message);
  if (!data) return [];

  /* 2. add computed fields (market pct + edges) --------------------------- */
  return data.map((row: any) => {
    const homeMktPct = mlToPct(row.home_ml);
    const awayMktPct = mlToPct(row.away_ml);

    return {
      matchup_id      : row.matchup_id,
      game_id         : row.game_id,
      game_time_ct    : row.game_time_ct,

      home_team       : row.home_team,
      away_team       : row.away_team,

      home_market_ml  : row.home_ml,
      away_market_ml  : row.away_ml,
      home_market_pct : homeMktPct,
      away_market_pct : awayMktPct,

      home_pred_ml    : row.home_pred_ml ?? pctToMl(row.home_pred_pct),
      away_pred_ml    : row.away_pred_ml ?? pctToMl(row.away_pred_pct),
      home_pred_pct   : row.home_pred_pct,
      away_pred_pct   : row.away_pred_pct,

      home_edge_pct   :
        row.home_pred_pct != null && homeMktPct != null
          ? row.home_pred_pct - homeMktPct
          : null,
      away_edge_pct   :
        row.away_pred_pct != null && awayMktPct != null
          ? row.away_pred_pct - awayMktPct
          : null,

      home_pitcher    : row.home_pitcher,
      away_pitcher    : row.away_pitcher,
    } as ProcessedMlbPrediction;
  });
}
