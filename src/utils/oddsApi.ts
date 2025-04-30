
import axios from 'axios';
import { dummyFromOdds, GameWithMarket, GameWithPrediction } from './generateDummyPrediction';

// Sport key mapping
export const SPORT_KEYS: Record<string, string> = {
  NFL: "americanfootball_nfl",
  NCAAF: "americanfootball_ncaaf",
  NCAAB: "basketball_ncaab",
  MLB: "baseball_mlb"
};

export type SportKey = keyof typeof SPORT_KEYS;
export const DEFAULT_SPORT: SportKey = "NFL";

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

interface Bookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: Market[];
}

interface Market {
  key: string;
  last_update: string;
  outcomes: Outcome[];
}

interface Outcome {
  name: string;
  price: number;
  point?: number;
}

// The Odds API client
const ODDS_API_KEY = 'ca659a5203c1cfc6a0275ebd54c57262';
const BASE_URL = 'https://api.the-odds-api.com/v4/sports';

export async function fetchOdds(sportKey: string): Promise<OddsApiGame[]> {
  try {
    const markets = sportKey.includes('baseball') ? 'h2h,spreads,totals' : 'spreads,totals';
    
    const { data } = await axios.get(
      `${BASE_URL}/${sportKey}/odds`,
      {
        params: {
          regions: 'us',
          markets: markets,
          dateFormat: 'iso',
          oddsFormat: 'american',
          apiKey: ODDS_API_KEY,
        },
        timeout: 10000
      }
    );
    return data;
  } catch (error) {
    console.error(`Error fetching odds for ${sportKey}:`, error);
    return [];
  }
}

// Helper for converting Odds API response to our TickerGame format with dummy predictions
export function convertToTickerGames(games: OddsApiGame[], timeZone: string = 'America/Chicago'): TickerGame[] {
  return games.map(game => {
    // Extract spread from first bookmaker with spreads market
    let spread = 0;
    let moneyline = undefined;
    let total = undefined;
    let consensus = undefined;
    let isBaseball = game.sport_key.includes('baseball');

    // Find the first bookmaker with spreads
    for (const bookmaker of game.bookmakers) {
      const spreadsMarket = bookmaker.markets.find(m => m.key === 'spreads');
      const totalsMarket = bookmaker.markets.find(m => m.key === 'totals');
      const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h');
      
      if (spreadsMarket) {
        const homeOutcome = spreadsMarket.outcomes.find(o => o.name === game.home_team);
        if (homeOutcome && homeOutcome.point !== undefined) {
          spread = homeOutcome.point;
          break;
        }
      }
      
      if (isBaseball && h2hMarket) {
        const homeOutcome = h2hMarket.outcomes.find(o => o.name === game.home_team);
        if (homeOutcome && homeOutcome.price) {
          moneyline = homeOutcome.price;
        }
      }
      
      if (totalsMarket && totalsMarket.outcomes.length > 0) {
        total = Math.abs(totalsMarket.outcomes[0].point || 0);
      }
    }

    const date = new Date(game.commence_time);
    
    // Create base game object
    const baseGame: GameWithMarket = {
      id: game.id,
      home_team: game.home_team,
      away_team: game.away_team,
      home: getTeamAbbreviation(game.home_team),
      away: getTeamAbbreviation(game.away_team),
      tip: formatGameTime(date, timeZone),
      market_spread: isBaseball ? null : spread,
      market_total: total,
      spread,
      moneyline,
      total,
      final: false,
      sport_key: game.sport_key
    };

    // Generate dummy predictions
    const withPredictions = dummyFromOdds(baseGame);
    
    // Map predictions to our TickerGame format
    return {
      id: game.id,
      home: getTeamAbbreviation(game.home_team),
      away: getTeamAbbreviation(game.away_team),
      tip: formatGameTime(date, timeZone),
      spread,
      moneyline,
      total,
      consensus: withPredictions.confidence_pct,
      final: false,
      sport_key: game.sport_key,
      predicted_margin: withPredictions.predicted_margin,
      predicted_total: withPredictions.predicted_total
    };
  });
}

// Helper function to format game time
function formatGameTime(date: Date, timeZone: string): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}

// Helper to get abbreviations for team names
function getTeamAbbreviation(teamName: string): string {
  // This is a simplified version - in a real app, you'd have a complete mapping
  const teamMap: Record<string, string> = {
    // NFL
    'Kansas City Chiefs': 'KC',
    'San Francisco 49ers': 'SF',
    'Dallas Cowboys': 'DAL',
    'Buffalo Bills': 'BUF',
    'Philadelphia Eagles': 'PHI',
    'Baltimore Ravens': 'BAL',
    
    // NCAAF
    'Georgia Bulldogs': 'UGA',
    'Michigan Wolverines': 'MICH',
    'Alabama Crimson Tide': 'BAMA',
    'Ohio State Buckeyes': 'OSU',
    
    // NCAAB
    'Gonzaga Bulldogs': 'GON',
    'Kansas Jayhawks': 'KAN',
    'Baylor Bears': 'BAY',
    'Duke Blue Devils': 'DUKE',
    
    // MLB
    'New York Yankees': 'NYY',
    'Los Angeles Dodgers': 'LAD',
    'Boston Red Sox': 'BOS',
    'Chicago Cubs': 'CHC',
    'Houston Astros': 'HOU',
    
    // Add more mappings as needed
  };
  
  return teamMap[teamName] || teamName.split(' ').pop()?.substring(0, 3).toUpperCase() || teamName.substring(0, 3).toUpperCase();
}

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
