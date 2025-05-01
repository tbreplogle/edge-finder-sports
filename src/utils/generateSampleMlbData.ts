
import { GameProps } from "@/components/GameCard";

// Function to generate sample MLB data for testing when API is unavailable
export function generateSampleMlbData(): GameProps[] {
  const today = new Date();
  const todayDateStr = today.toISOString().split('T')[0];
  
  const sampleGames: GameProps[] = [
    {
      id: "685100",
      sport: "mlb",
      homeTeam: "NYY",
      awayTeam: "BOS",
      startTime: `${todayDateStr}T18:05:00Z`,
      marketSpread: -1.5,
      predictedMargin: 1.8,
      edge: 3.3,
      confidence: 62,
      isPremium: false,
      isPreviewGame: true
    },
    {
      id: "685101",
      sport: "mlb",
      homeTeam: "LAD",
      awayTeam: "SF",
      startTime: `${todayDateStr}T19:10:00Z`,
      marketSpread: -1,
      predictedMargin: 1.2,
      edge: 2.2,
      confidence: 58,
      isPremium: true
    },
    {
      id: "685102",
      sport: "mlb",
      homeTeam: "HOU",
      awayTeam: "TEX",
      startTime: `${todayDateStr}T17:10:00Z`,
      marketSpread: 0,
      predictedMargin: -0.5,
      edge: -0.5,
      confidence: 52,
      isPremium: true
    },
    {
      id: "685103",
      sport: "mlb",
      homeTeam: "CHC",
      awayTeam: "STL",
      startTime: `${todayDateStr}T13:20:00Z`,
      marketSpread: 1,
      predictedMargin: -1.5,
      edge: -2.5,
      confidence: 60,
      isPremium: true
    },
    {
      id: "685104",
      sport: "mlb",
      homeTeam: "ATL",
      awayTeam: "PHI",
      startTime: `${todayDateStr}T18:20:00Z`,
      marketSpread: -1,
      predictedMargin: 1.3,
      edge: 2.3,
      confidence: 57,
      isPremium: true
    }
  ];
  
  return sampleGames;
}
