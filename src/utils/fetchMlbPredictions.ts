import { supabase } from "@/integrations/supabase/client";
import { fetchOdds, SPORT_KEYS } from "@/utils/oddsApi";
import { OddsApiGame } from "@/utils/types/sports";

export interface MlbPrediction {
  matchup_id: string;
  team_id: number;
  moneyline: number | null;
  rating: number | null;
  adjusted_rating: number | null;
  win_pct: number | null;
  created_at: string;
}

export interface MlbMatchup {
  matchup_id: string;
  game_id: string;
  home_team: string;
  away_team: string;
  game_date: string;
  home_team_id: number | null;
  away_team_id: number | null;
}

export interface ProcessedMlbPrediction {
  matchup_id: string;
  game_id: string;
  home_team: string;
  away_team: string;
  game_date: string;
  moneyline: number | null;
  market_ml: number | null;
  market_implied_pct: number | null;    // fraction 0–1
  predicted_implied_pct: number | null; // fraction 0–1
  edge_pct: number | null;              // difference
  updated_at: string;
}

// Calculate implied probability (0–1) from a moneyline.
function calculateImpliedProbability(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

export async function fetchMlbPredictions(): Promise<ProcessedMlbPrediction[]> {
  try {
    // Fix: Add proper type parameters to the supabase queries
    const { data: predictionsData, error: predictionsError } = await supabase
      .from("mlb_predictions")
      .select("*")
      .order("created_at", { ascending: false });

    if (predictionsError) throw predictionsError;
    if (!predictionsData) return [];

    // Fix: Add proper type parameters to the supabase queries
    const { data: matchupsData, error: matchupsError } = await supabase
      .from("mlb_matchups")
      .select("*");

    if (matchupsError) throw matchupsError;
    if (!matchupsData) return [];

    // pull live odds
    const sportKey = SPORT_KEYS.MLB;
    const liveOddsData = await fetchOdds(sportKey);

    // map for quick lookup
    const matchupsMap = new Map(matchupsData.map(m => [m.matchup_id, m] as const));
    const oddsMap = new Map(liveOddsData.map(o => [o.id, o] as const));

    // keep only the latest prediction per matchup
    const latest = new Map<string, MlbPrediction>();
    predictionsData.forEach(p => {
      const existing = latest.get(p.matchup_id);
      if (!existing || new Date(p.created_at) > new Date(existing.created_at)) {
        latest.set(p.matchup_id, p as MlbPrediction);
      }
    });

    const out: ProcessedMlbPrediction[] = [];

    latest.forEach(pred => {
      const m = matchupsMap.get(pred.matchup_id);
      if (!m) return;

      // find live-API game by id or team names
      const liveGame = oddsMap.get(m.game_id)
        ?? Array.from(oddsMap.values()).find(g =>
             (g.home_team === m.home_team && g.away_team === m.away_team)
          );

      let market_ml: number | null = null;
      if (liveGame) {
        const bm = liveGame.bookmakers?.[0];
        const h2h = bm?.markets.find(x => x.key === "h2h");
        if (h2h) {
          // pick the odds for whichever team this pred is for
          const homeO = h2h.outcomes.find(o => o.name === m.home_team);
          const awayO = h2h.outcomes.find(o => o.name === m.away_team);
          if (pred.team_id === m.home_team_id && homeO) market_ml = homeO.price;
          if (pred.team_id === m.away_team_id && awayO) market_ml = awayO.price;
        }
      }

      const predictedImpliedPct = pred.moneyline != null
        ? calculateImpliedProbability(pred.moneyline)
        : null;

      const marketImpliedPct = market_ml != null
        ? calculateImpliedProbability(market_ml)
        : null;

      const edge_pct = (predictedImpliedPct != null && marketImpliedPct != null)
        ? predictedImpliedPct - marketImpliedPct
        : null;

      out.push({
        matchup_id: pred.matchup_id,
        game_id: m.game_id,
        home_team: m.home_team,
        away_team: m.away_team,
        game_date: m.game_date,
        moneyline: pred.moneyline,
        market_ml,
        predicted_implied_pct: predictedImpliedPct,
        market_implied_pct: marketImpliedPct,
        edge_pct,
        updated_at: pred.created_at
      });
    });

    return out;
  }
  catch (e) {
    console.error("fetchMlbPredictions error:", e);
    return [];
  }
}
