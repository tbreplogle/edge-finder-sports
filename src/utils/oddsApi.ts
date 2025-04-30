
import axios from 'axios';

// Sport key mapping
export const SPORT_KEYS = {
  nfl: "americanfootball_nfl",
  ncaaf: "americanfootball_ncaaf",
  nba: "basketball_nba",
  ncaab: "basketball_ncaab",
  mlb: "baseball_mlb"
};

export type SportKey = keyof typeof SPORT_KEYS;

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
    const { data } = await axios.get(
      `${BASE_URL}/${sportKey}/odds`,
      {
        params: {
          regions: 'us',
          markets: 'spreads,totals',
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

// Helper for converting Odds API response to our TickerGame format
export function convertToTickerGames(games: OddsApiGame[], timeZone: string = 'America/Chicago'): TickerGame[] {
  return games.map(game => {
    // Extract spread from first bookmaker with spreads market
    let spread = 0;
    let total = undefined;
    let consensus = undefined;

    // Find the first bookmaker with spreads
    for (const bookmaker of game.bookmakers) {
      const spreadsMarket = bookmaker.markets.find(m => m.key === 'spreads');
      const totalsMarket = bookmaker.markets.find(m => m.key === 'totals');
      
      if (spreadsMarket) {
        const homeOutcome = spreadsMarket.outcomes.find(o => o.name === game.home_team);
        if (homeOutcome && homeOutcome.point !== undefined) {
          spread = homeOutcome.point;
          // Generate random consensus between 50-80% for demo purposes
          consensus = Math.floor(Math.random() * 31) + 50;
          break;
        }
      }
      
      if (totalsMarket && totalsMarket.outcomes.length > 0) {
        total = Math.abs(totalsMarket.outcomes[0].point || 0);
      }
    }

    const date = new Date(game.commence_time);
    
    return {
      id: game.id,
      home: getTeamAbbreviation(game.home_team),
      away: getTeamAbbreviation(game.away_team),
      tip: formatGameTime(date, timeZone),
      spread,
      total,
      consensus,
      final: false // The API doesn't provide final status, so we'll assume it's not final
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
    // NBA
    'Milwaukee Bucks': 'MIL',
    'Indiana Pacers': 'IND',
    'Denver Nuggets': 'DEN',
    'Los Angeles Lakers': 'LAL',
    'Golden State Warriors': 'GS',
    'Houston Rockets': 'HOU',
    'Boston Celtics': 'BOS',
    'New York Knicks': 'NYK',
    'Phoenix Suns': 'PHX',
    'Dallas Mavericks': 'DAL',
    'Philadelphia 76ers': 'PHI',
    'Miami Heat': 'MIA',
    
    // NFL
    'Kansas City Chiefs': 'KC',
    'San Francisco 49ers': 'SF',
    'Dallas Cowboys': 'DAL',
    'Buffalo Bills': 'BUF',
    'Philadelphia Eagles': 'PHI',
    'Baltimore Ravens': 'BAL',
    
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
  total?: number;
  consensus?: number;
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
