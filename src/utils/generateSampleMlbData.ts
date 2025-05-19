
import { CardProps } from "@/components/GameCard";

export const generateSampleMlbData = (): Partial<CardProps>[] => {
  return [
    {
      id: "1",
      matchup_id: "1234",
      game_id: "12345",
      sport: "mlb",
      home_team: "Los Angeles Dodgers",
      away_team: "San Francisco Giants",
      game_time_ct: "2023-06-15T19:10:00.000Z",
      home_market_ml: -150,
      away_market_ml: +135,
      home_market_pct: 0.6,
      away_market_pct: 0.4,
      home_pred_ml: -175,
      away_pred_ml: +155,
      home_pred_pct: 0.63,
      away_pred_pct: 0.37,
      home_edge_pct: 0.03,
      away_edge_pct: -0.03,
      home_pitcher: "Clayton Kershaw",
      away_pitcher: "Logan Webb",
      isAdmin: false,
      isPaid: false,
      isPremium: true
    },
    {
      id: "2",
      matchup_id: "2345",
      game_id: "23456",
      sport: "mlb",
      home_team: "New York Yankees",
      away_team: "Boston Red Sox",
      game_time_ct: "2023-06-15T20:05:00.000Z",
      home_market_ml: -200,
      away_market_ml: +175,
      home_market_pct: 0.67,
      away_market_pct: 0.33,
      home_pred_ml: -150,
      away_pred_ml: +130,
      home_pred_pct: 0.6,
      away_pred_pct: 0.4,
      home_edge_pct: -0.07,
      away_edge_pct: 0.07,
      home_pitcher: "Gerrit Cole",
      away_pitcher: "Chris Sale",
      isAdmin: false,
      isPaid: false,
      isPremium: true
    }
  ];
};
