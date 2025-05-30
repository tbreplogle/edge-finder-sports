import { supabase } from "@/integrations/supabase/client";

/* ─ helpers ─────────────────────────────────────────────────────────────── */
const mlToPct = (ml: number | null) =>
  ml == null ? null : ml > 0 ? 100 / (ml + 100) : Math.abs(ml) / (Math.abs(ml) + 100);

const pctToMl = (p: number | null) =>
  p == null
    ? null
    : p >= 0.5
    ? -Math.round((p / (1 - p)) * 100)
    : Math.round(((1 - p) / p) * 100);

/* ─ types ────────────────────────────────────────────────────────────────── */
export interface ProcessedMlbPrediction {
  matchup_id: string;
  game_id: string;
  game_time_ct: string;

  home_team: string;
  away_team: string;

  home_market_ml:  number | null;
  away_market_ml:  number | null;
  home_market_pct: number | null;
  away_market_pct: number | null;

  home_pred_ml:  number | null;
  away_pred_ml:  number | null;
  home_pred_pct: number | null;
  away_pred_pct: number | null;

  home_edge_pct: number | null;
  away_edge_pct: number | null;

  home_confidence: number
  away_confidence: number

  home_pitcher: string | null;
  away_pitcher: string | null;
}

/* ─ fetcher ─────────────────────────────────────────────────────────────── */
export async function fetchMlbPredictions(): Promise<ProcessedMlbPrediction[]> {
  // 1.  Query the view directly (no RPC)  
  const { data, error } = await supabase
    .from("mlb_predictions_with_market")
    .select("*");

  if (error) throw new Error(error.message);
  if (!data)   return [];

  // 2.  Massage fields for the frontend
  return data.map((r: any) => {
    const homeMktPct = r.home_market_pct ?? mlToPct(r.home_market_ml);
    const awayMktPct = r.away_market_pct ?? mlToPct(r.away_market_ml);

    const hp = r.home_pred_pct ?? null;
    const ap = r.away_pred_pct ?? null;

    return {
      matchup_id:  r.matchup_id,
      game_id:     r.game_id,
      game_time_ct:r.game_time_ct,

      home_team:   r.home_team,
      away_team:   r.away_team,

      home_market_ml:  r.home_market_ml,
      away_market_ml:  r.away_market_ml,
      home_market_pct: homeMktPct,
      away_market_pct: awayMktPct,

      home_pred_pct: hp,
      away_pred_pct: ap,
      home_pred_ml:  pctToMl(hp),
      away_pred_ml:  pctToMl(ap),

      home_edge_pct: hp  != null && homeMktPct != null ? hp  - homeMktPct  : null,
      away_edge_pct: ap  != null && awayMktPct != null ? ap  - awayMktPct  : null,

      home_pitcher: r.home_pitcher ?? null,
      away_pitcher: r.away_pitcher ?? null,

      home_confidence: r.home_confidence,
      away_confidence: r.away_confidence,
    } as ProcessedMlbPrediction;
  });
}
