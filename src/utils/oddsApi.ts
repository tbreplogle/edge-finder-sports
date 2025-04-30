
import axios from 'axios';
import { SPORT_KEYS } from './config/sportKeys';
import { dummyFromOdds, GameWithMarket } from './generateDummyPrediction';
import { getTeamAbbreviation } from './helpers/teamAbbreviations';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { OddsApiGame, TickerGame } from './types/sports';

const ODDS_API_KEY = import.meta.env.VITE_ODDS_API_KEY || '';
const BASE_URL     = 'https://api.the-odds-api.com/v4/sports';
const TZ           = 'America/Chicago';               // local tz for bucketing

/* fetch odds for a sport within a 3-day window (yesterday-today-tomorrow) */
export async function fetchOdds(sportKey: string): Promise<OddsApiGame[]> {
  const isBaseball = sportKey.includes('baseball');
  const markets    = isBaseball ? 'h2h,totals' : 'spreads,totals';

  // If no API key is provided, return mock data for development
  if (!ODDS_API_KEY) {
    console.warn('[Ticker] No API key found, returning mock data');
    
    // Return 3 mock games
    return Array(3).fill(null).map((_, i) => ({
      id: `mock-${i}`,
      sport_key: sportKey,
      sport_title: sportKey.split('_').pop() || '',
      commence_time: new Date(Date.now() + (i * 24 * 60 * 60 * 1000)).toISOString(),
      home_team: isBaseball ? 'Los Angeles Dodgers' : 'Kansas City Chiefs',
      away_team: isBaseball ? 'New York Yankees' : 'San Francisco 49ers',
      bookmakers: [{
        key: 'mock',
        title: 'Mock Bookmaker',
        last_update: new Date().toISOString(),
        markets: [
          isBaseball ? 
          {
            key: 'h2h',
            last_update: new Date().toISOString(),
            outcomes: [
              { name: isBaseball ? 'Los Angeles Dodgers' : 'Kansas City Chiefs', price: -150 },
              { name: isBaseball ? 'New York Yankees' : 'San Francisco 49ers', price: 130 }
            ]
          } :
          {
            key: 'spreads',
            last_update: new Date().toISOString(),
            outcomes: [
              { name: 'Kansas City Chiefs', price: -110, point: -3.5 },
              { name: 'San Francisco 49ers', price: -110, point: 3.5 }
            ]
          },
          {
            key: 'totals',
            last_update: new Date().toISOString(),
            outcomes: [
              { name: 'Over', price: -110, point: isBaseball ? 8.5 : 48.5 },
              { name: 'Under', price: -110, point: isBaseball ? 8.5 : 48.5 }
            ]
          }
        ]
      }]
    }));
  }

  const { data } = await axios.get(`${BASE_URL}/${sportKey}/odds`, {
    params: {
      regions: 'us',
      markets,
      dateFormat: 'iso',
      oddsFormat: 'american',
      daysFrom: 3,                // ← wider window catches UTC offsets
      apiKey: ODDS_API_KEY
    },
    timeout: 10_000
  });

  return data;
}

/* ----------  convertToTickerGames  ---------- */
export function convertToTickerGames(
  games: OddsApiGame[],
  sportKey: string
): TickerGame[] {
  const isBaseball = sportKey.includes('baseball');

  return games.map(g => {
    /* --- extract market prices --- */
    let spread = 0;
    let moneyHome: number | undefined;
    let moneyAway: number | undefined;
    let total: number | undefined;

    for (const bm of g.bookmakers) {
      const spreads = bm.markets.find(m => m.key === 'spreads');
      const totals  = bm.markets.find(m => m.key === 'totals');
      const h2h     = bm.markets.find(m => m.key === 'h2h');

      if (!isBaseball && spreads) {
        const out = spreads.outcomes.find(o => o.name === g.home_team);
        if (out?.point !== undefined) spread = out.point;
      }

      if (isBaseball && h2h) {
        moneyHome = h2h.outcomes.find(o => o.name === g.home_team)?.price;
        moneyAway = h2h.outcomes.find(o => o.name === g.away_team)?.price;
      }

      if (totals?.outcomes?.length) {
        total = Math.abs(totals.outcomes[0].point ?? 0);
      }
    }

    /* --- convert start time to America/Chicago string --- */
    const tip = formatInTimeZone(new Date(g.commence_time), TZ, 'h:mm aaaa');

    const base: GameWithMarket = {
      id: g.id,
      home_team: g.home_team,
      away_team: g.away_team,
      home: getTeamAbbreviation(g.home_team),
      away: getTeamAbbreviation(g.away_team),
      tip,
      market_spread: isBaseball ? null : spread,
      market_total : total,
      spread,
      moneyline: moneyHome,
      moneyline_opponent: moneyAway,
      total,
      final: false,
      sport_key: g.sport_key
    };

    const withPred = dummyFromOdds(base);

    return {
      id: base.id,
      home: base.home,
      away: base.away,
      tip: base.tip,
      spread: isBaseball ? 0 : spread,
      moneyline: moneyHome,
      moneyline_opponent: moneyAway,
      total,
      consensus: withPred.confidence_pct,
      final: false,
      sport_key: g.sport_key,
      show_prediction: false
    };
  });
}

export { SPORT_KEYS } from './config/sportKeys';
export type { TickerGame } from './types/sports';
