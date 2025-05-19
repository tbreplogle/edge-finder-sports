
// Add TypeScript interfaces for sports-related data

export interface TickerGame {
  id: string;
  sport_key?: string;
  game_id?: string;
  home: string;
  away: string;
  home_score?: number;
  away_score?: number;
  time?: string;
  status?: string;
  final?: boolean;
  moneyline?: number;
  moneyline_opponent?: number;
  spread?: number;
  score_away?: number;
  score_home?: number;
  total?: number;
  tip?: string;
}

export interface TickerData {
  games: TickerGame[];
  lastUpdated: string;
}

export interface OddsApiGame {
  id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string;
      outcomes: Array<{
        name: string;
        price: number;
      }>;
    }>;
  }>;
}

export interface GameCardProps {
  id: string;
  matchup_id?: string;
  game_id?: string;
  sport?: string;
  home_team?: string;
  homeTeam?: string;
  away_team?: string;
  awayTeam?: string;
  game_time_ct?: string;
  startTime?: string;
  home_market_ml?: number;
  homeMarketMoneyline?: number;
  away_market_ml?: number;
  awayMarketMoneyline?: number;
  home_market_pct?: number;
  away_market_pct?: number;
  home_pred_ml?: number;
  homePredictedOdds?: number;
  away_pred_ml?: number;
  awayPredictedOdds?: number;
  home_pred_pct?: number;
  homePredictedPct?: number;
  away_pred_pct?: number;
  awayPredictedPct?: number;
  home_edge_pct?: number;
  homeEdgePct?: number;
  away_edge_pct?: number;
  awayEdgePct?: number;
  homePitcher?: string;
  awayPitcher?: string;
  home_pitcher?: string;
  away_pitcher?: string;
  variant?: string;
  isAdmin?: boolean;
  isPaid?: boolean;
  isPremium?: boolean;
  isFeatured?: boolean;
  isPreviewGame?: boolean;
  edgePct?: number;
}
