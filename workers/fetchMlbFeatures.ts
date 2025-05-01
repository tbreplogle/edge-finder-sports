
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import { TeamStats, PitcherStats, Matchup } from '../src/lib/formulas/mlbPredict';

const STATS_API  = 'https://statsapi.mlb.com/api/v1';
const SAVANT_CSV = 'https://baseballsavant.mlb.com/preview';
const DAYS = 14;                                // ← last-2-weeks window

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

/* Build today's match-up objects */
export async function buildTodayMatchups(): Promise<Matchup[]> {
  const pitchers = await pullProbablePitchers();

  const { data } = await axios.get(`${STATS_API}/schedule`, {
    params: { sportId: 1, date: end, hydrate: 'probablePitcher' }
  });

  const res: Matchup[] = [];
  for (const d of data.dates) {
    for (const g of d.games) {
      const gid = g.gamePk.toString();
      res.push({
        game_id: gid,
        home: g.teams.home.team.abbreviation,
        away: g.teams.away.team.abbreviation,
        pitcher_home: pitchers[`${gid}_home`],
        pitcher_away: pitchers[`${gid}_away`]
      });
    }
  }
  
  console.log(`Built ${res.length} matchups for today`);
  return res;
}
