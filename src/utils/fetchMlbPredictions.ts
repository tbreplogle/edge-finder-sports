import { supabase } from "@/integrations/supabase/client";

/* helpers ----------------------------------------------------------------- */
const mlToPct = (ml: number | null): number | null =>
  ml == null ? null : ml > 0 ? 100 / (ml + 100) : Math.abs(ml) / (Math.abs(ml) + 100);

const pctToMl = (p: number | null): number | null =>
  p == null ? null : p > 0.5 ? -Math.round((p / (1 - p)) * 100) : Math.round(((1 - p) / p) * 100);

/* type -------------------------------------------------------------------- */
export interface ProcessedMlbPrediction {
  matchup_id: string;
  game_id: string;
  home_team: string;
  away_team: string;
  game_time_ct: string;

  home_market_ml: number | null;
  away_market_ml: number | null;
  home_market_pct: number | null;
  away_market_pct: number | null;

  home_pred_pct: number | null;
  away_pred_pct: number | null;
  home_pred_ml: number | null;
  away_pred_ml: number | null;

  home_edge_pct: number | null;
  away_edge_pct: number | null;

  home_pitcher: string | null;
  away_pitcher: string | null;
}

/* fetcher ------------------------------------------------------------------ */
export async function fetchMlbPredictions(): Promise<ProcessedMlbPrediction[]> {
  const { data: pred, error: predErr } = await supabase
    .from("mlb_predictions")
    .select("matchup_id, team_id, win_pct, created_at")
    .order("created_at", { ascending: false });
  if (predErr) throw new Error(predErr.message);

  const latest = new Map<string, number>();
  pred.forEach(r => {
    const k = `${r.matchup_id}_${r.team_id}`;
    if (!latest.has(k)) latest.set(k, r.win_pct ?? null);
  });

  const { data: odds, error: oddsErr } = await supabase
    .from("mlb_market_odds")
    .select("matchup_id, game_id, game_time_ct, home_team_id, away_team_id, home_ml, away_ml");
  if (oddsErr) throw new Error(oddsErr.message);

  const { data: mus, error: muErr } = await supabase
    .from("mlb_matchups")
    .select("matchup_id, home_team, away_team");
  if (muErr) throw new Error(muErr.message);
  const muMap = new Map(mus.map(m => [m.matchup_id, m]));

  const { data: pitch, error: pitErr } = await supabase
    .from("pitching_matchups")
    .select("matchup_id, pitcher_role, pitcher_name");
  if (pitErr) throw new Error(pitErr.message);

  const pitcherMap = new Map<string, string>();
  pitch.forEach(p => pitcherMap.set(`${p.matchup_id}_${p.pitcher_role}`, p.pitcher_name));

  return odds.map(o => {
    const mu = muMap.get(o.matchup_id);
    const hp = latest.get(`${o.matchup_id}_${o.home_team_id}`) ?? null;
    const ap = latest.get(`${o.matchup_id}_${o.away_team_id}`) ?? null;

    const homePct = mlToPct(o.home_ml);
    const awayPct = mlToPct(o.away_ml);

    return {
      matchup_id: o.matchup_id,
      game_id: o.game_id,
      home_team: mu?.home_team ?? "",
      away_team: mu?.away_team ?? "",
      game_time_ct: o.game_time_ct,

      home_market_ml: o.home_ml,
      away_market_ml: o.away_ml,
      home_market_pct: homePct,
      away_market_pct: awayPct,

      home_pred_pct: hp,
      away_pred_pct: ap,
      home_pred_ml: pctToMl(hp),
      away_pred_ml: pctToMl(ap),

      home_edge_pct: hp != null && homePct != null ? hp - homePct : null,
      away_edge_pct: ap != null && awayPct != null ? ap - awayPct : null,

      home_pitcher: pitcherMap.get(`${o.matchup_id}_home`) ?? null,
      away_pitcher: pitcherMap.get(`${o.matchup_id}_away`) ?? null
    };
  });
}
