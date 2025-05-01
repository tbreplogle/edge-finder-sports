
import axios from 'axios';
import { parse } from 'csv-parse/sync';

// Type definitions
export interface TeamStats {
  team: string;
  HR: number;
  HRA: number;
  BA: number;
}

export interface PitcherStats {
  game_id: string;
  team: string;
  ERAplus: number;
  WHIP: number;
}

export interface Matchup {
  game_id: string;
  home: string;
  away: string;
  pitcher_home?: PitcherStats;
  pitcher_away?: PitcherStats;
  moneyline?: number;
  moneyline_opponent?: number;
  total?: number;
}

const STATS_API  = 'https://statsapi.mlb.com/api/v1';
const SAVANT_CSV = 'https://baseballsavant.mlb.com/preview';
const ODDS_API   = 'https://api.the-odds-api.com/v4/sports';
const ODDS_KEY   = process.env.ODDS_API_KEY || 'ca659a5203c1cfc6a0275ebd54c57262';
const DAYS = 14;                                // ← last-2-weeks window for stats

const today    = new Date();
const fromDate = new Date(today);
fromDate.setDate(today.getDate() - DAYS);
const start = fromDate.toISOString().slice(0, 10);
const end   = today.toISOString().slice(0, 10);

/* Team totals: HR, HRA, BA (last-14-days) */
export async function pullTeamStats(): Promise<Record<string, TeamStats>> {
  const { data } = await axios.get(`${STATS_API}/teams/statistics`, {
    params: { startDate: start, endDate: end, group: 'hitting,pitching', sportId: 1 }
  });

  const map: Record<string, TeamStats> = {};
  for (const t of data.stats) {
    const hit  = t.group.find((g: any) => g.group.displayName === 'hitting')?.splits?.[0]?.stat;
    const pit  = t.group.find((g: any) => g.group.displayName === 'pitching')?.splits?.[0]?.stat;
    const abb  = t.team.abbreviation;

    map[abb] = {
      team: abb,
      HR : +hit?.homeRuns      ?? 0,
      HRA: +pit?.homeRuns      ?? 0,
      BA : +(hit?.avg          ?? 0)
    };
  }
  console.log(`Pulled ${Object.keys(map).length} team stats rows`);
  return map;
}

/* Pull ERA+/WHIP for each probable starter (last-14-days) */
async function savantPitcherWindow(pid: number) {
  const url = `${SAVANT_CSV}?player_type=pitcher&player_id=${pid}` +
              `&game_date_gt=${start}&game_date_lt=${end}&all=true`;
  const csv = await axios.get(url).then(r => r.data as string);
  const rows = parse(csv, { columns: true, skip_empty_lines: true });

  const ip = rows.reduce((s: number, r: any) => s + +r.ip, 0);
  const er = rows.reduce((s: number, r: any) => s + +r.er, 0);
  const h  = rows.reduce((s: number, r: any) => s + +r.h , 0);
  const bb = rows.reduce((s: number, r: any) => s + +r.bb, 0);

  const era   = ip ? (er * 9) / ip : 0;
  const whip  = ip ? (h + bb) / ip : 0;
  const eraPlus = era ? (100 * 4.00) / era : 100;   // lg-avg ERA ≈ 4.00

  return { era_plus: Math.round(eraPlus), whip: +whip.toFixed(2) };
}

export async function pullProbablePitchers(): Promise<Record<string, PitcherStats>> {
  const { data } = await axios.get(`${STATS_API}/schedule`, {
    params: { sportId: 1, date: end, hydrate: 'probablePitcher' }
  });

  const map: Record<string, PitcherStats> = {};

  for (const d of data.dates) {
    for (const g of d.games) {
      const gid = g.gamePk.toString();

      for (const side of ['home', 'away'] as const) {
        const club = g.teams[side];
        const pid  = club.probablePitcher?.id;
        if (!pid) continue;

        try {
          const stats = await savantPitcherWindow(pid);
          map[`${gid}_${side}`] = {
            game_id: gid,
            team   : club.team.abbreviation,
            ERAplus: stats.era_plus,
            WHIP   : stats.whip
          };
        } catch (err) {
          console.error(`Error fetching stats for pitcher ${pid}:`, err);
          // Use default league average values if we can't get data
          map[`${gid}_${side}`] = {
            game_id: gid,
            team   : club.team.abbreviation,
            ERAplus: 100, // League average
            WHIP   : 1.30 // Approximate league average
          };
        }
      }
    }
  }
  
  console.log(`Pulled ${Object.keys(map).length} pitcher stats entries`);
  return map;
}

/* Fetch current odds for MLB games */
async function fetchOdds() {
  try {
    const { data } = await axios.get(`${ODDS_API}/baseball_mlb/odds`, {
      params: {
        regions: 'us',
        markets: 'h2h,totals',
        dateFormat: 'iso',
        oddsFormat: 'american',
        apiKey: ODDS_KEY
      }
    });
    
    // Create a map of game IDs to odds
    const oddsMap: Record<string, { home_ml?: number, away_ml?: number, total?: number }> = {};
    
    for (const game of data) {
      // Find the first bookmaker with available h2h odds
      const h2hMarket = game.bookmakers?.[0]?.markets?.find(m => m.key === 'h2h');
      const totalMarket = game.bookmakers?.[0]?.markets?.find(m => m.key === 'totals');
      
      if (h2hMarket) {
        const homeOdds = h2hMarket.outcomes.find(o => o.name === game.home_team)?.price;
        const awayOdds = h2hMarket.outcomes.find(o => o.name === game.away_team)?.price;
        
        oddsMap[game.id] = {
          home_ml: homeOdds,
          away_ml: awayOdds,
          total: totalMarket?.outcomes?.[0]?.point
        };
      }
    }
    
    console.log(`Fetched odds for ${Object.keys(oddsMap).length} MLB games`);
    return oddsMap;
  } catch (err) {
    console.error('Error fetching odds:', err);
    return {};
  }
}

/* Build today's match-up objects */
export async function buildTodayMatchups(): Promise<Matchup[]> {
  const pitchers = await pullProbablePitchers();
  const oddsMap = await fetchOdds();

  const { data } = await axios.get(`${STATS_API}/schedule`, {
    params: { sportId: 1, date: end, hydrate: 'probablePitcher' }
  });

  const res: Matchup[] = [];
  for (const d of data.dates) {
    for (const g of d.games) {
      const gid = g.gamePk.toString();
      const game_date = new Date(g.gameDate);
      
      // Only include games scheduled for today
      if (game_date.toDateString() === new Date().toDateString()) {
        // Try to match with odds data
        const odds = oddsMap[gid] || {};
        
        res.push({
          game_id: gid,
          home: g.teams.home.team.abbreviation,
          away: g.teams.away.team.abbreviation,
          pitcher_home: pitchers[`${gid}_home`],
          pitcher_away: pitchers[`${gid}_away`],
          moneyline: odds.home_ml,
          moneyline_opponent: odds.away_ml,
          total: odds.total
        });
      }
    }
  }
  
  console.log(`Built ${res.length} matchups for today`);
  return res;
}
