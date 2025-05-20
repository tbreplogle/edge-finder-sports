import { supabase } from "@/integrations/supabase/client";

/* ──────────────────────────────────────────────────────────────────────────
   Helper converters
   ────────────────────────────────────────────────────────────────────────── */
const mlToPct = (ml: number | null): number | null =>
  ml == null
    ? null
    : ml > 0
    ? 100 / (ml + 100)
    : Math.abs(ml) / (Math.abs(ml) + 100);

const pctToMl = (p: number | null): number | null =>
  p == null
    ? null
    : p >= 0.5
    ? -Math.round((p / (1 - p)) * 100)
    : Math.round(((1 - p) / p) * 100);

/* ──────────────────────────────────────────────────────────────────────────
   Type returned to the front-end
   ────────────────────────────────────────────────────────────────────────── */
export interface ProcessedMlbPrediction {
  matchup_id:      string;
  game_id:         string;
  game_time_ct:    string;

  home_team:       string;
  away_team:       string;

  home_market_ml:  number | null;
  away_market_ml:  number | null;
  home_market_pct: number | null;
  away_market_pct: number | null;

  home_pred_ml:    number | null;
  away_pred_ml:    number | null;
  home_pred_pct:   number | null;
  away_pred_pct:   number | null;

  home_edge_pct:   number | null;
  away_edge_pct:   number | null;

  home_pitcher:    string | null;
  away_pitcher:    string | null;
}

/* ──────────────────────────────────────────────────────────────────────────
   Fetcher (reads directly from the VIEW)
   ────────────────────────────────────────────────────────────────────────── */
export async function fetchMlbPredictions(): Promise<ProcessedMlbPrediction[]> {
  // read every column from the view and order by first pitch
  const { data, error } = await supabase
    .from("mlb_predictions_with_market")
    .select("*")
    .order("game_time_ct", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  /* normalise + derive extra fields for the UI --------------------------- */
  return (data as any[]).map((row) => {
    // market implied % (view might already include, but fall back just in case)
    const homeMarketPct = row.home_market_pct ?? mlToPct(row.home_market_ml);
    const awayMarketPct = row.away_market_pct ?? mlToPct(row.away_market_ml);

    // predicted % (view should include, but guard anyway)
    const homePredPct  = row.home_pred_pct ?? null;
    const awayPredPct  = row.away_pred_pct ?? null;

    return {
      matchup_id:   row.matchup_id,
      game_id:      row.game_id,
      game_time_ct: row.game_time_ct,

      home_team:    row.home_team,
      away_team:    row.away_team,

      home_market_ml:  row.home_market_ml,
      away_market_ml:  row.away_market_ml,
      home_market_pct: homeMarketPct,
      away_market_pct: awayMarketPct,

      home_pred_pct:   homePredPct,
      away_pred_pct:   awayPredPct,
      home_pred_ml:    pctToMl(homePredPct),
      away_pred_ml:    pctToMl(awayPredPct),

      home_edge_pct:
        homePredPct != null && homeMarketPct != null
          ? homePredPct - homeMarketPct
          : null,
      away_edge_pct:
        awayPredPct != null && awayMarketPct != null
          ? awayPredPct - awayMarketPct
          : null,

      home_pitcher: row.home_pitcher ?? null,
      away_pitcher: row.away_pitcher ?? null,
    } as ProcessedMlbPrediction;
  });
}
