
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
}


// --- newly added for fetchMlbPredictions.ts ---
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
