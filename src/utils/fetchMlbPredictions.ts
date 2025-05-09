import { supabase } from "@/integrations/supabase/client";

/* ────────────────────────────────────────────────────────────────────────────
   helpers
   ────────────────────────────────────────────────────────────────────────── */
function mlToPct(ml: number | null): number | null {
  if (ml == null) return null;
  return ml > 0
    ? 100 / (ml + 100)
    : Math.abs(ml) / (Math.abs(ml) + 100);
}

function pctToMl(p: number | null): number | null {
  if (p == null) return null;
  return p > 0.5
    ? -Math.round((p / (1 - p)) * 100)
    :  Math.round(((1 - p) / p) * 100);
}

/* ────────────────────────────────────────────────────────────────────────────
   type
   ────────────────────────────────────────────────────────────────────────── */
export interface ProcessedMlbPrediction {
  matchup_id: string;
  game_id:   string;
  home_team: string;
  away_team: string;
  game_time_ct: string;      // ISO in central‑time

  home_market_ml:  number | null;
  away_market_ml:  number | null;
  home_market_pct: number | null;
  away_market_pct: number | null;

  home_pred_pct:   number | null;
  away_pred_pct:   number | null;
  home_pred_ml:    number | null;
  away_pred_ml:    number | null;

  home_edge_pct:   number | null;   // pred – market
  away_edge_pct:   number | null;
}

/* ────────────────────────────────────────────────────────────────────────────
   main fetcher
   ────────────────────────────────────────────────────────────────────────── */
export async function fetchMlbPredictions(): Promise<ProcessedMlbPrediction[]> {
  /* 1) get most‑recent rows in mlb_predictions (team level) */
  const { data: predRows, error: predErr } = await supabase
    .from("mlb_predictions")
    .select("matchup_id, team_id, win_pct, created_at")
    .order("created_at", { ascending: false });

  if (predErr) throw new Error(predErr.message);

  /* keep first (latest) row per (matchup_id,team_id) */
  const predMap = new Map<string, number>();  // key = matchup_team
  predRows.forEach(r => {
    const k = `${r.matchup_id}_${r.team_id}`;
    if (!predMap.has(k)) predMap.set(k, r.win_pct ?? null);
  });

  /* 2) join market odds + names + time */
  const { data: oddsRows, error: oddsErr } = await supabase
    .from("mlb_market_odds")
    .select(`matchup_id, game_id, game_time_ct,
             home_team_id, away_team_id,
             home_ml, away_ml`);

  if (oddsErr) throw new Error(oddsErr.message);

  const { data: muRows, error: muErr } = await supabase
    .from("mlb_matchups")
    .select("matchup_id, home_team, away_team");

  if (muErr) throw new Error(muErr.message);
  const muMap = new Map(muRows.map(m => [m.matchup_id, m]));

  /* 3) build output */
  return oddsRows.map(o => {
    const mu = muMap.get(o.matchup_id);
    const homePredPct = predMap.get(`${o.matchup_id}_${o.home_team_id}`) ?? null;
    const awayPredPct = predMap.get(`${o.matchup_id}_${o.away_team_id}`) ?? null;

    const homeMktPct = mlToPct(o.home_ml);
    const awayMktPct = mlToPct(o.away_ml);

    return {
      matchup_id      : o.matchup_id,
      game_id         : o.game_id,
      home_team       : mu?.home_team ?? "",
      away_team       : mu?.away_team ?? "",
      game_time_ct    : o.game_time_ct,

      home_market_ml  : o.home_ml,
      away_market_ml  : o.away_ml,
      home_market_pct : homeMktPct,
      away_market_pct : awayMktPct,

      home_pred_pct   : homePredPct,
      away_pred_pct   : awayPredPct,
      home_pred_ml    : pctToMl(homePredPct),
      away_pred_ml    : pctToMl(awayPredPct),

      home_edge_pct   : (homePredPct!=null && homeMktPct!=null) ? homePredPct - homeMktPct : null,
      away_edge_pct   : (awayPredPct!=null && awayMktPct!=null) ? awayPredPct - awayMktPct : null
    };
  });
}
