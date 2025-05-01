
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
}

export interface PredictionRow {
  game_id: string;
  home_team: string;
  away_team: string;
  predicted_margin: number;
  home_prob: number;
}

// Formula to predict MLB game outcomes based on team and pitcher stats
export function predictMatchup(matchup: Matchup, teamStats: Record<string, TeamStats>): PredictionRow {
  const home = teamStats[matchup.home] || { HR: 0, HRA: 0, BA: 0, team: matchup.home };
  const away = teamStats[matchup.away] || { HR: 0, HRA: 0, BA: 0, team: matchup.away };
  
  // Pitcher adjustment factors
  const homePitcherFactor = matchup.pitcher_home ? 
    (matchup.pitcher_home.ERAplus / 100) * (2 - Math.min(1.5, matchup.pitcher_home.WHIP)) : 1;
  
  const awayPitcherFactor = matchup.pitcher_away ? 
    (matchup.pitcher_away.ERAplus / 100) * (2 - Math.min(1.5, matchup.pitcher_away.WHIP)) : 1;
  
  // Base offensive strength 
  const homeOffense = (home.HR * 1.5 + home.BA * 1000) * homePitcherFactor;
  const awayOffense = (away.HR * 1.5 + away.BA * 1000) * awayPitcherFactor;
  
  // Base defensive weakness
  const homeDefense = home.HRA * 1.2;
  const awayDefense = away.HRA * 1.2;
  
  // Home field advantage - roughly 4% in MLB
  const homeAdvantage = 1.04;
  
  // Calculate final strength indicators
  const homeStrength = homeOffense + awayDefense;
  const awayStrength = awayOffense + homeDefense;
  
  // Apply home field advantage
  const adjustedHomeStrength = homeStrength * homeAdvantage;
  
  // Calculate win probability for home team
  const totalStrength = adjustedHomeStrength + awayStrength;
  const homeProbability = adjustedHomeStrength / totalStrength;
  
  // Convert to a run margin with some randomness (MLB typical margin is ~1.5-2 runs)
  const marginFactor = 4.5; // Tunable parameter
  const rawMargin = (homeProbability - 0.5) * marginFactor;
  
  // Round to 1 decimal place
  const predictedMargin = Math.round(rawMargin * 10) / 10;
  
  return {
    game_id: matchup.game_id,
    home_team: matchup.home,
    away_team: matchup.away,
    predicted_margin: predictedMargin,
    home_prob: homeProbability
  };
}
