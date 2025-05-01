
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
  game_id: string;
  home_team: string;
  away_team: string;
  predicted_margin: number;
  home_prob: number;
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
export function predictMatchup(matchup: Matchup, teamStats: Record<string, TeamStats>): PredictionRow {
  const home = teamStats[matchup.home] || { HR: 0, HRA: 0, BA: 0, team: matchup.home };
  const away = teamStats[matchup.away] || { HR: 0, HRA: 0, BA: 0, team: matchup.away };
  
  const rHome = rawRating(home, matchup.pitcher_home);
  const rAway = rawRating(away, matchup.pitcher_away);

  const pHome = scalePct(rHome, true);
  const pAway = scalePct(rAway, false);

  /* Probabilities with your formula */
  const awayProb = (pAway - pAway * pHome) / (pAway + pHome - 2 * pAway * pHome);
  const homeProb = 1 - awayProb;

  /* Margin proxy = rating diff ÷ 10 (tunable) */
  const margin = +((rHome - rAway) / 10).toFixed(1);
  
  return {
    game_id: matchup.game_id,
    home_team: matchup.home,
    away_team: matchup.away,
    predicted_margin: margin,
    home_prob: homeProb
  };
}
