
import axios from 'axios';
import { dummyFromOdds, GameWithMarket } from './generateDummyPrediction';
import { SPORT_KEYS, SportKey } from './config/sportKeys';
import { getTeamAbbreviation } from './helpers/teamAbbreviations';
import { formatGameTime } from './helpers/dateFormatting';
import { OddsApiGame, TickerGame } from './types/sports';

// Re-export keys for backward compatibility
export { SPORT_KEYS, DEFAULT_SPORT } from './config/sportKeys';
export type { SportKey } from './config/sportKeys';

// The Odds API client
const ODDS_API_KEY = 'ca659a5203c1cfc6a0275ebd54c57262';
const BASE_URL = 'https://api.the-odds-api.com/v4/sports';

export async function fetchOdds(sportKey: string): Promise<OddsApiGame[]> {
  try {
    // For baseball, we want h2h (moneyline) instead of spreads
    const markets = sportKey.includes('baseball') ? 'h2h,totals' : 'spreads,totals';
    
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
    const isBaseball = game.sport_key.includes('baseball');

    // Find the first bookmaker with spreads
    for (const bookmaker of game.bookmakers) {
      const spreadsMarket = bookmaker.markets.find(m => m.key === 'spreads');
      const totalsMarket = bookmaker.markets.find(m => m.key === 'totals');
      const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h');
      
      if (spreadsMarket && !isBaseball) {
        const homeOutcome = spreadsMarket.outcomes.find(o => o.name === game.home_team);
        if (homeOutcome && homeOutcome.point !== undefined) {
          spread = homeOutcome.point;
          break;
        }
      }
      
      if (h2hMarket && isBaseball) {
        const homeOutcome = h2hMarket.outcomes.find(o => o.name === game.home_team);
        if (homeOutcome && homeOutcome.price) {
          moneyline = homeOutcome.price;
          break; // Exit loop once we've found the moneyline
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
      spread: isBaseball ? 0 : spread, // Set spread to 0 for baseball
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

// Re-export TickerGame type for backward compatibility
export type { TickerGame } from './types/sports';
export type { TickerDay } from './types/sports';
export type { TickerData } from './types/sports';
