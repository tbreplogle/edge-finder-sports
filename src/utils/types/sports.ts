
// Types for the ticker data structure
export interface TickerGame {
  id?: string;
  home: string;
  away: string;
  tip?: string;
  final?: boolean;
  score_home?: number;
  score_away?: number;
  spread: number;
  moneyline?: number;
  moneyline_opponent?: number; // Added for comparing favorite logic
  total?: number;
  consensus?: number;
  sport_key?: string;
  predicted_margin?: number;
  predicted_total?: number | null;
  show_prediction?: boolean;
  matchup_id?: string; // Added for consistency with GameProps
}

export interface TickerDay {
  label: string;
  date: string;
  games: TickerGame[];
}

export interface TickerData {
  sport: string;
  days: TickerDay[];
}

// API response types
export interface OddsApiGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
}

export interface Bookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: Market[];
}

export interface Market {
  key: string;
  last_update: string;
  outcomes: Outcome[];
}

export interface Outcome {
  name: string;
  price: number;
  point?: number;
}

// MLB prediction types
export interface MlbPrediction {
  game_id: string;
  home_team: string;
  away_team: string;
  predicted_margin: number;
  home_prob: number;
  home_ml?: number;
  away_ml?: number;
  market_home_ml?: number;
  market_away_ml?: number;
  edge?: number;
  matchup_id?: string; // Added for consistency
}

// --- newly added for fetchMlbPredictions.ts ---
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
  
  // These fields are needed for MlbPredictionDisplay compatibility
  game_date?: string;
  updated_at?: string;
}

// Display format for MLB predictions in tables
export interface MlbPredictionDisplay extends ProcessedMlbPrediction {
  game_date: string;
  updated_at: string;
}
