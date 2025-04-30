
import axios from 'axios';
import { SPORT_KEYS } from './config/sportKeys';
import { dummyFromOdds, GameWithMarket } from './generateDummyPrediction';
import { getTeamAbbreviation } from './helpers/teamAbbreviations';
import { formatGameTime } from './helpers/dateFormatting';
import { OddsApiGame, TickerGame } from './types/sports';

// Using Vite's environment variable format
const ODDS_API_KEY = import.meta.env.VITE_ODDS_API_KEY || '';
const BASE_URL = 'https://api.the-odds-api.com/v4/sports';

export async function fetchOdds(sportKey: string): Promise<OddsApiGame[]> {
  const isBaseball = sportKey.includes('baseball');
  const markets    = isBaseball ? 'h2h,totals' : 'spreads,totals';

  // For development/testing when API key isn't available, return dummy data
  if (!ODDS_API_KEY) {
    console.warn('[Ticker] No API key found, returning mock data');
    return mockGamesData(sportKey);
  }

  const { data } = await axios.get(`${BASE_URL}/${sportKey}/odds`, {
    params: {
      regions: 'us',
      markets,
      dateFormat: 'iso',
      oddsFormat: 'american',
      apiKey: ODDS_API_KEY
    },
    timeout: 10_000
  });

  return data;
}

/* ---------- Mock data for development/testing ---------- */
function mockGamesData(sportKey: string): OddsApiGame[] {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  const tomorrow = new Date(now.getTime() + 86400000);
  
  const getMockTeams = () => {
    if (sportKey.includes('baseball')) {
      return {
        home: 'Los Angeles Dodgers',
        away: 'San Francisco Giants'
      };
    } else if (sportKey.includes('basketball')) {
      return {
        home: 'Los Angeles Lakers',
        away: 'Golden State Warriors' 
      };
    } else {
      return {
        home: 'Dallas Cowboys',
        away: 'Philadelphia Eagles'
      };
    }
  };

  const { home, away } = getMockTeams();
  
  return [
    // Today's game
    {
      id: 'mock-game-today',
      sport_key: sportKey,
      sport_title: sportKey.split('_').join(' ').toUpperCase(),
      commence_time: now.toISOString(),
      home_team: home,
      away_team: away,
      bookmakers: [{
        key: 'mock-bookmaker',
        title: 'Mock Bookmaker',
        last_update: now.toISOString(),
        markets: [
          {
            key: sportKey.includes('baseball') ? 'h2h' : 'spreads',
            last_update: now.toISOString(),
            outcomes: sportKey.includes('baseball') 
              ? [
                  { name: home, price: -150, point: undefined },
                  { name: away, price: +130, point: undefined }
                ]
              : [
                  { name: home, price: -110, point: -4.5 },
                  { name: away, price: -110, point: 4.5 }
                ]
          },
          {
            key: 'totals',
            last_update: now.toISOString(),
            outcomes: [
              { name: 'Over', price: -110, point: sportKey.includes('baseball') ? 8.5 : 49.5 },
              { name: 'Under', price: -110, point: sportKey.includes('baseball') ? 8.5 : 49.5 }
            ]
          }
        ]
      }]
    },
    // Yesterday's game
    {
      id: 'mock-game-yesterday',
      sport_key: sportKey,
      sport_title: sportKey.split('_').join(' ').toUpperCase(),
      commence_time: yesterday.toISOString(),
      home_team: home,
      away_team: away,
      bookmakers: [{
        key: 'mock-bookmaker',
        title: 'Mock Bookmaker',
        last_update: yesterday.toISOString(),
        markets: [
          {
            key: sportKey.includes('baseball') ? 'h2h' : 'spreads',
            last_update: yesterday.toISOString(),
            outcomes: sportKey.includes('baseball') 
              ? [
                  { name: home, price: -160, point: undefined },
                  { name: away, price: +140, point: undefined }
                ] 
              : [
                  { name: home, price: -110, point: -3.5 },
                  { name: away, price: -110, point: 3.5 }
                ]
          }
        ]
      }]
    },
    // Tomorrow's game
    {
      id: 'mock-game-tomorrow',
      sport_key: sportKey,
      sport_title: sportKey.split('_').join(' ').toUpperCase(),
      commence_time: tomorrow.toISOString(),
      home_team: home,
      away_team: away,
      bookmakers: [{
        key: 'mock-bookmaker',
        title: 'Mock Bookmaker',
        last_update: tomorrow.toISOString(),
        markets: [
          {
            key: sportKey.includes('baseball') ? 'h2h' : 'spreads',
            last_update: tomorrow.toISOString(),
            outcomes: sportKey.includes('baseball') 
              ? [
                  { name: home, price: -140, point: undefined },
                  { name: away, price: +120, point: undefined }
                ]
              : [
                  { name: home, price: -110, point: -2.5 },
                  { name: away, price: -110, point: 2.5 }
                ]
          }
        ]
      }]
    }
  ];
}

/* ----------  convertToTickerGames  ---------- */
export function convertToTickerGames(
  games: OddsApiGame[],
  sportKey: string,
  tz = 'America/Chicago'
): TickerGame[] {
  const isBaseballSport = sportKey.includes('baseball');

  return games.map((game): TickerGame => {
    let spread = 0;
    let moneylineHome: number | undefined;
    let moneylineAway: number | undefined;
    let total: number | undefined;

    for (const bm of game.bookmakers) {
      const spreads = bm.markets.find(m => m.key === 'spreads');
      const totals  = bm.markets.find(m => m.key === 'totals');
      const h2h     = bm.markets.find(m => m.key === 'h2h');

      if (!isBaseballSport && spreads) {
        const out = spreads.outcomes.find(o => o.name === game.home_team);
        if (out?.point !== undefined) {
          spread = out.point;
          break;
        }
      }

      if (isBaseballSport && h2h) {
        moneylineHome = h2h.outcomes.find(o => o.name === game.home_team)?.price;
        moneylineAway = h2h.outcomes.find(o => o.name === game.away_team)?.price;
        break;
      }

      if (totals?.outcomes?.length) {
        total = Math.abs(totals.outcomes[0].point ?? 0);
      }
    }

    const tip = formatGameTime(new Date(game.commence_time), tz);

    const base: GameWithMarket = {
      id: game.id,
      home_team: game.home_team,
      away_team: game.away_team,
      home: getTeamAbbreviation(game.home_team),
      away: getTeamAbbreviation(game.away_team),
      tip,
      market_spread: isBaseballSport ? null : spread,
      market_total: total,
      spread,
      moneyline: moneylineHome,
      moneyline_opponent: moneylineAway,
      total,
      final: false,
      sport_key: game.sport_key
    };

    const withPred = dummyFromOdds(base); // remove later

    return {
      id: base.id,
      home: base.home,
      away: base.away,
      tip: base.tip,
      spread: isBaseballSport ? 0 : spread,
      moneyline: moneylineHome,
      moneyline_opponent: moneylineAway,
      total,
      consensus: withPred.confidence_pct,
      final: false,
      sport_key: game.sport_key,
      show_prediction: false            // never show preds in ticker
    };
  });
}

export { SPORT_KEYS };
export type { TickerGame } from './types/sports';
export interface TickerData {
  sport: string;
  days: {
    label: string;
    date: string;
    games: TickerGame[];
  }[];
}
