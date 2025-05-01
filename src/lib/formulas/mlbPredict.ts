
// Types for MLB predictions
export interface TeamStats {
  team: string;
  HR: number;   // Home Runs
  HRA: number;  // Home Runs Allowed
  BA: number;   // Batting Average
}

export interface PitcherStats {
  game_id: string;
  team: string;
  ERAplus: number;  // ERA+ (adjusted ERA)
  WHIP: number;     // Walks + Hits per Inning Pitched
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

export interface PredictionRow {
  sport: string;
  game_id: string;
  home_team: string;
  away_team: string;
  predicted_margin: number;
  predicted_total: null;
  confidence_pct: number;
}

/* exact‐formula predictor -------------------------------------------------*/
function rawRating(t: TeamStats, p: PitcherStats | undefined) {
  if (!p) {
    // Default values if pitcher stats are not available
    return (
      56.74 +
      0.108  * t.HR  -
      0.0934 * t.HRA +
      334.9  * t.BA
    );
  }
  
  return (
    56.74 +
    0.108  * t.HR  -
    0.0934 * t.HRA +
    334.9  * t.BA  +
    0.188  * p.ERAplus -
    61.98  * p.WHIP
  );
}

function scalePct(rating: number, isHome: boolean) {
  const base = rating / 162;
  const pct  = ((base * 14) + 0.5) / 15;      // ((x*(15-1)+.5)/15)
  return pct * (isHome ? 1.02 : 0.98);        // HFA tweak
}

// Formula to predict MLB game outcomes based on team and pitcher stats
export function predictMatchup(m: Matchup, map: Record<string, TeamStats>): PredictionRow {
  const Rhome = rawRating(map[m.home] || { HR: 0, HRA: 0, BA: 0, team: m.home }, m.pitcher_home);
  const Raway = rawRating(map[m.away] || { HR: 0, HRA: 0, BA: 0, team: m.away }, m.pitcher_away);

  const Phome = scalePct(Rhome, /*isHome=*/true);
  const Paway = scalePct(Raway, false);

  const awayProb = (Paway - Paway*Phome) / (Paway + Phome - 2*Paway*Phome);
  const homeProb = 1 - awayProb;

  return {
    sport: 'MLB',
    game_id: m.game_id,
    home_team: m.home,
    away_team: m.away,
    predicted_margin: +((Rhome - Raway)/10).toFixed(1),
    predicted_total: null,
    confidence_pct: Math.round(homeProb*100)
  };
}
