
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
  total?: number;
  consensus?: number;
  sport_key?: string;
  predicted_margin?: number;
  predicted_total?: number | null;
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
