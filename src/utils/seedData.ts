
// This file provides seed data for development environments
// It can be used in frontend components for previews and testing

export const seedGames = [
  {
    id: "seed-nfl-1",
    sport: "nfl",
    homeTeam: "Chiefs",
    awayTeam: "Raiders",
    startTime: new Date().toISOString(),
    marketSpread: -7.5,
    predictedMargin: -9.2,
    edge: 1.7,
    confidence: 65,
    rawFactors: {
      home_offense_rank: 3,
      home_defense_rank: 8,
      away_offense_rank: 22,
      away_defense_rank: 14,
      home_field_advantage: 2.5,
      injuries_impact: -0.5
    }
  },
  {
    id: "seed-ncaaf-1",
    sport: "ncaaf",
    homeTeam: "Georgia",
    awayTeam: "Alabama",
    startTime: new Date().toISOString(),
    marketSpread: -4.5,
    predictedMargin: -7.8,
    edge: 3.3,
    confidence: 68,
    isPremium: true,
    rawFactors: {
      home_offense_rank: 2,
      home_defense_rank: 1,
      away_offense_rank: 3,
      away_defense_rank: 5,
      home_field_advantage: 3.0,
      recruitment_class_diff: 0.5
    }
  },
  {
    id: "seed-ncaab-1",
    sport: "ncaab",
    homeTeam: "Duke",
    awayTeam: "UNC",
    startTime: new Date().toISOString(),
    marketSpread: -3,
    predictedMargin: -6.2,
    edge: 3.2,
    confidence: 70,
    isPremium: true,
    rawFactors: {
      home_offense_efficiency: 118.5,
      home_defense_efficiency: 95.2,
      away_offense_efficiency: 115.8,
      away_defense_efficiency: 97.3,
      tempo_adjustment: 1.2
    }
  },
  {
    id: "seed-mlb-1",
    sport: "mlb",
    homeTeam: "Dodgers",
    awayTeam: "Giants",
    startTime: new Date().toISOString(),
    marketSpread: -1.5,
    predictedMargin: -2.8,
    edge: 1.3,
    confidence: 63,
    isPremium: true,
    rawFactors: {
      home_starting_pitcher_era: 2.85,
      away_starting_pitcher_era: 3.75,
      home_batting_average: 0.265,
      away_batting_average: 0.248,
      ballpark_factor: 102
    }
  }
];
