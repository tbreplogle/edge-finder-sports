
import axios from 'axios';
import { SPORT_KEYS } from './config/sportKeys';
import { dummyFromOdds, GameWithMarket } from './generateDummyPrediction';
import { getTeamAbbreviation } from './helpers/teamAbbreviations';
import { formatInTimeZone } from 'date-fns-tz';
import { OddsApiGame, TickerGame } from './types/sports';

// Set the API key from environment variables
const ODDS_API_KEY = 'ca659a5203c1cfc6a0275ebd54c57262'; // Will be injected at build time
const BASE_URL     = 'https://api.the-odds-api.com/v4/sports';
const TZ           = 'America/Chicago';               // local tz for bucketing

/* fetch odds for a sport within a 3-day window (yesterday-today-tomorrow) */
export async function fetchOdds(sportKey: string): Promise<OddsApiGame[]> {
  const isBaseball = sportKey.includes('baseball');
  const markets    = isBaseball ? 'h2h,totals' : 'spreads,totals';

  try {
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
    
    console.log(`[Ticker] Fetched ${data.length} games for ${sportKey}`);
    return data;
  } catch (error) {
    console.error('[Ticker] Error fetching odds:', error);
    
    // Return empty array on error
    return [];
  }
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
