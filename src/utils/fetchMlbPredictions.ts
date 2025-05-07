
import { supabase } from "@/integrations/supabase/client";
import { fetchOdds, SPORT_KEYS } from "@/utils/oddsApi";
import { OddsApiGame } from "@/utils/types/sports";
import { Tables } from "@/integrations/supabase/types";

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
  home_moneyline: number | null;
  away_moneyline: number | null;
  home_market_ml: number | null;
  away_market_ml: number | null;
  home_predicted_pct: number | null;
  away_predicted_pct: number | null;
  home_market_implied_pct: number | null;
  away_market_implied_pct: number | null;
  edge_pct: number | null;
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
    // Use proper type parameters for the Supabase queries
    const { data: predictionsData, error: predictionsError } = await supabase
      .from<"mlb_predictions", MlbPrediction>("mlb_predictions")
      .select("*")
      .order("created_at", { ascending: false });

    if (predictionsError) throw predictionsError;
    if (!predictionsData || !Array.isArray(predictionsData)) return [];

    // Convert to MlbPrediction type to ensure type safety
    const typedPredictions: MlbPrediction[] = predictionsData;
    
    const { data: matchupsData, error: matchupsError } = await supabase
      .from<"mlb_matchups", MlbMatchup>("mlb_matchups")
      .select("*");

    if (matchupsError) throw matchupsError;
    if (!matchupsData || !Array.isArray(matchupsData)) return [];
    
    // Convert to MlbMatchup type to ensure type safety
    const typedMatchups: MlbMatchup[] = matchupsData;

    // pull live odds
    const sportKey = SPORT_KEYS.MLB;
    const liveOddsData = await fetchOdds(sportKey);

    // map for quick lookup
    const matchupsMap = new Map(typedMatchups.map(m => [m.matchup_id, m] as const));
    const oddsMap = new Map(liveOddsData.map(o => [o.id, o] as const));

    // Group predictions by matchup_id to get both teams
    const predictionsByMatchup = new Map<string, MlbPrediction[]>();
    
    for (const pred of typedPredictions) {
      if (!predictionsByMatchup.has(pred.matchup_id)) {
        predictionsByMatchup.set(pred.matchup_id, []);
      }
      
      const existingPreds = predictionsByMatchup.get(pred.matchup_id)!;
      
      // Check if we already have a prediction for this team
      const teamPredIndex = existingPreds.findIndex(p => p.team_id === pred.team_id);
      
      if (teamPredIndex === -1) {
        // No prediction for this team yet, add it
        existingPreds.push(pred);
      } else if (new Date(pred.created_at) > new Date(existingPreds[teamPredIndex].created_at)) {
        // Newer prediction for this team, replace it
        existingPreds[teamPredIndex] = pred;
      }
    }

    const out: ProcessedMlbPrediction[] = [];

    for (const [matchupId, preds] of predictionsByMatchup.entries()) {
      const m = matchupsMap.get(matchupId);
      if (!m) continue;

      // find live-API game by id or team names
      const liveGame = oddsMap.get(m.game_id)
        ?? Array.from(oddsMap.values()).find(g =>
             (g.home_team === m.home_team && g.away_team === m.away_team)
          );

      // Extract market ML for both teams
      let home_market_ml: number | null = null;
      let away_market_ml: number | null = null;
      
      if (liveGame) {
        const bm = liveGame.bookmakers?.[0];
        const h2h = bm?.markets.find(x => x.key === "h2h");
        if (h2h) {
          const homeO = h2h.outcomes.find(o => o.name === m.home_team);
          const awayO = h2h.outcomes.find(o => o.name === m.away_team);
          
          if (homeO) home_market_ml = homeO.price;
          if (awayO) away_market_ml = awayO.price;
        }
      }

      // Process predictions for each team
      let home_moneyline: number | null = null;
      let away_moneyline: number | null = null;
      let home_predicted_pct: number | null = null;
      let away_predicted_pct: number | null = null;
      
      for (const pred of preds) {
        if (pred.team_id === m.home_team_id) {
          home_moneyline = pred.moneyline;
          // Store win_pct as a decimal (0-1) value
          home_predicted_pct = pred.win_pct ? pred.win_pct / 100 : null;
        } else if (pred.team_id === m.away_team_id) {
          away_moneyline = pred.moneyline;
          // Store win_pct as a decimal (0-1) value
          away_predicted_pct = pred.win_pct ? pred.win_pct / 100 : null;
        }
      }

      const home_market_implied_pct = home_market_ml != null ? calculateImpliedProbability(home_market_ml) : null;
      const away_market_implied_pct = away_market_ml != null ? calculateImpliedProbability(away_market_ml) : null;

      // Calculate edge as the difference between predicted and market for the higher probability team
      let edge_pct: number | null = null;
      
      if (home_predicted_pct != null && home_market_implied_pct != null) {
        edge_pct = (home_predicted_pct - home_market_implied_pct) * 100;
      } else if (away_predicted_pct != null && away_market_implied_pct != null) {
        edge_pct = (away_predicted_pct - away_market_implied_pct) * 100;
      }

      out.push({
        matchup_id: matchupId,
        game_id: m.game_id,
        home_team: m.home_team,
        away_team: m.away_team,
        game_date: m.game_date,
        home_moneyline,
        away_moneyline,
        home_market_ml,
        away_market_ml,
        home_predicted_pct,
        away_predicted_pct,
        home_market_implied_pct,
        away_market_implied_pct,
        edge_pct,
        updated_at: preds[0]?.created_at || new Date().toISOString()
      });
    }

    return out;
  }
  catch (e) {
    console.error("fetchMlbPredictions error:", e);
    return [];
  }
}
