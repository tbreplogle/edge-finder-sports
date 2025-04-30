
import axios from 'axios';
import { SPORT_KEYS, DEFAULT_SPORT } from './config/sportKeys';
import { dummyFromOdds, GameWithMarket } from './generateDummyPrediction';
import { getTeamAbbreviation } from './helpers/teamAbbreviations';
import { formatGameTime } from './helpers/dateFormatting';
import { OddsApiGame, TickerGame } from './types/sports';

// Accessing the environment variable using Vite's import.meta.env instead of process.env
const ODDS_API_KEY = import.meta.env.VITE_ODDS_API_KEY || '';
const BASE_URL = 'https://api.the-odds-api.com/v4/sports';

export async function fetchOdds(sportKey: string): Promise<OddsApiGame[]> {
  const isBaseball = sportKey.includes('baseball');
  const markets    = isBaseball ? 'h2h,totals' : 'spreads,totals';

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

export { SPORT_KEYS, DEFAULT_SPORT };
export type { TickerGame } from './types/sports';
