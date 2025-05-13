
import { GameProps } from "@/components/GameCard";

// Function to generate sample MLB data for testing when API is unavailable
export function generateSampleMlbData(): GameProps[] {
  const today = new Date();
  const todayDateStr = today.toISOString().split('T')[0];
  
  const sampleGames: GameProps[] = [
    {
      id: "685100",
      matchup_id: "685100",
      game_id: "685100",
      home_team: "PHI",
      away_team: "WSH",
      game_time_ct: `${todayDateStr}T21:45:00Z`, // 5:45 p.m. ET
      home_market_ml: -150,
      away_market_ml: +130,
      home_market_pct: 0.60,
      away_market_pct: 0.40,
      home_pred_ml: -160,
      away_pred_ml: +140,
      home_pred_pct: 0.62,
      away_pred_pct: 0.38,
      home_edge_pct: 0.02,
      away_edge_pct: -0.02,
      home_pitcher: "Wheeler",
      away_pitcher: "Gore",
      isAdmin: false,
      isPaid: false
    },
    {
      id: "685101",
      matchup_id: "685101",
      game_id: "685101",
      home_team: "TOR",
      away_team: "BOS",
      game_time_ct: `${todayDateStr}T22:07:00Z`, // 6:07 p.m. ET
      home_market_ml: -120,
      away_market_ml: +110,
      home_market_pct: 0.545,
      away_market_pct: 0.455,
      home_pred_ml: -130,
      away_pred_ml: +120,
      home_pred_pct: 0.565,
      away_pred_pct: 0.435,
      home_edge_pct: 0.02,
      away_edge_pct: -0.02,
      home_pitcher: "Berrios",
      away_pitcher: "Houck",
      isAdmin: false,
      isPaid: false
    },
    {
      id: "685102",
      matchup_id: "685102",
      game_id: "685102",
      home_team: "LAA",
      away_team: "DET",
      game_time_ct: `${todayDateStr}T00:38:00Z`, // 8:38 p.m. ET
      home_market_ml: 150,
      away_market_ml: -170,
      home_market_pct: 0.40,
      away_market_pct: 0.60,
      home_pred_ml: 130,
      away_pred_ml: -150,
      home_pred_pct: 0.435,
      away_pred_pct: 0.565,
      home_edge_pct: 0.035,
      away_edge_pct: -0.035,
      home_pitcher: "Sandoval",
      away_pitcher: "Skubal",
      isAdmin: false,
      isPaid: false
    },
    {
      id: "685103",
      matchup_id: "685103",
      game_id: "685103",
      home_team: "SF",
      away_team: "COL",
      game_time_ct: `${todayDateStr}T01:45:00Z`, // 9:45 p.m. ET
      home_market_ml: -200,
      away_market_ml: +180,
      home_market_pct: 0.667,
      away_market_pct: 0.333,
      home_pred_ml: -220,
      away_pred_ml: +200,
      home_pred_pct: 0.688,
      away_pred_pct: 0.312,
      home_edge_pct: 0.021,
      away_edge_pct: -0.021,
      home_pitcher: "Webb",
      away_pitcher: "Freeland",
      isAdmin: false,
      isPaid: false
    }
  ];
  
  return sampleGames;
}
