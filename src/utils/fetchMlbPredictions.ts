
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
  market_implied_pct: number | null;
  predicted_implied_pct: number | null;
  edge_pct: number | null;
  updated_at: string;
}

// Calculate implied probability from moneyline odds
function calculateImpliedProbability(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

export async function fetchMlbPredictions(): Promise<ProcessedMlbPrediction[]> {
  try {
    // Fetch predictions from mlb_predictions table
    const { data: predictionsData, error: predictionsError } = await supabase
      .from('mlb_predictions')
      .select('*')
      .order('created_at', { ascending: false });

    if (predictionsError) throw new Error(`Error fetching MLB predictions: ${predictionsError.message}`);
    
    // Fetch matchups to get team names and game details
    const { data: matchupsData, error: matchupsError } = await supabase
      .from('mlb_matchups')
      .select('*');
    
    if (matchupsError) throw new Error(`Error fetching MLB matchups: ${matchupsError.message}`);

    // Fetch live odds data
    const sportKey = SPORT_KEYS.MLB; 
    const liveOddsData = await fetchOdds(sportKey);

    // Create a map of matchups by matchup_id
    const matchupsMap = new Map<string, MlbMatchup>();
    matchupsData.forEach((matchup) => {
      matchupsMap.set(matchup.matchup_id, matchup);
    });

    // Create a map of live odds by game_id
    const oddsMap = new Map<string, OddsApiGame>();
    liveOddsData.forEach((game) => {
      // Assuming there's a correlation between game_id in your DB and id in the API
      oddsMap.set(game.id, game);
    });

    // Group predictions by matchup_id to ensure we have latest prediction per matchup
    const latestPredictions = new Map<string, MlbPrediction>();
    
    if (predictionsData) {
      predictionsData.forEach((prediction) => {
        const existing = latestPredictions.get(prediction.matchup_id);
        if (!existing || new Date(prediction.created_at) > new Date(existing.created_at)) {
          latestPredictions.set(prediction.matchup_id, prediction);
        }
      });
    }

    // Process and combine the data
    const processedPredictions: ProcessedMlbPrediction[] = [];

    latestPredictions.forEach((prediction) => {
      const matchup = matchupsMap.get(prediction.matchup_id);
      if (!matchup) return; // Skip if no matchup found

      // Find live odds for this game
      let marketMoneyline: number | null = null;
      const liveOdds = Array.from(oddsMap.values()).find(game => 
        (game.home_team === matchup.home_team && game.away_team === matchup.away_team) ||
        (game.id === matchup.game_id)
      );

      if (liveOdds) {
        // Extract moneyline from the live odds
        const bookmaker = liveOdds.bookmakers?.[0];
        if (bookmaker) {
          const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h');
          if (h2hMarket) {
            // Get the moneyline for the team that this prediction is for
            const homeTeamOutcome = h2hMarket.outcomes.find(o => o.name === matchup.home_team);
            if (homeTeamOutcome && prediction.team_id === matchup.home_team_id) {
              marketMoneyline = homeTeamOutcome.price;
            }
            
            const awayTeamOutcome = h2hMarket.outcomes.find(o => o.name === matchup.away_team);
            if (awayTeamOutcome && prediction.team_id === matchup.away_team_id) {
              marketMoneyline = awayTeamOutcome.price;
            }
          }
        }
      }

      // Calculate implied probabilities
      const predictedImpliedPct = prediction.moneyline ? calculateImpliedProbability(prediction.moneyline) / 100 : null;
      const marketImpliedPct = marketMoneyline ? calculateImpliedProbability(marketMoneyline) / 100 : null;
      
      // Calculate edge percentage
      let edgePct = null;
      if (predictedImpliedPct !== null && marketImpliedPct !== null) {
        edgePct = predictedImpliedPct - marketImpliedPct;
      }

      processedPredictions.push({
        matchup_id: prediction.matchup_id,
        game_id: matchup.game_id,
        home_team: matchup.home_team,
        away_team: matchup.away_team,
        game_date: matchup.game_date,
        moneyline: prediction.moneyline,
        market_ml: marketMoneyline,
        market_implied_pct: marketImpliedPct,
        predicted_implied_pct: predictedImpliedPct,
        edge_pct: edgePct,
        updated_at: prediction.created_at
      });
    });

    return processedPredictions;
  } catch (error) {
    console.error('Error processing MLB predictions:', error);
    return [];
  }
}
