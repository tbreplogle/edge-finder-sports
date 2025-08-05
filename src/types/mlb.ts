export interface MlbBet {
    matchup_id: string;
    game_date: string;
    game_time_ct: string;
    away_team: string;
    home_team: string;
    away_market_ml: number | null;
    home_market_ml: number | null;
    away_pred_pct: number | null;
    home_pred_pct: number | null;
    away_edge_pct: number | null;
    home_edge_pct: number | null;
  }
  
  export interface MlbResult {
    id: string;
    season: string;
    game_date: string;
    away_team: string;
    home_team: string;
    away_score: number;
    home_score: number;
    market_spread: number;
    predicted_margin: number;
    actual_margin: number;
    edge: number;
  }
  