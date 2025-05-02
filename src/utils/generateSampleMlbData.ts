import { GameProps } from "@/components/GameCard";

// Function to generate sample MLB data for testing when API is unavailable
export function generateSampleMlbData(): GameProps[] {
  const today = new Date();
  const todayDateStr = today.toISOString().split('T')[0];
  
  const sampleGames: GameProps[] = [
    {
      id: "685100",
      sport: "mlb",
      homeTeam: "PHI",
      awayTeam: "WSH",
      startTime: `${todayDateStr}T21:45:00Z`, // 5:45 p.m. ET
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
      homeTeam: "TOR",
      awayTeam: "BOS",
      startTime: `${todayDateStr}T22:07:00Z`, // 6:07 p.m. ET
      marketSpread: -1,
      predictedMargin: 1.2,
      edge: 2.2,
      confidence: 58,
      isPremium: true
    },
    {
      id: "685102",
      sport: "mlb",
      homeTeam: "LAA",
      awayTeam: "DET",
      startTime: `${todayDateStr}T00:38:00Z`, // 8:38 p.m. ET
      marketSpread: 1.5,
      predictedMargin: -0.8,
      edge: -2.3,
      confidence: 56,
      isPremium: true
    },
    {
      id: "685103",
      sport: "mlb",
      homeTeam: "SF",
      awayTeam: "COL",
      startTime: `${todayDateStr}T01:45:00Z`, // 9:45 p.m. ET
      marketSpread: -2,
      predictedMargin: 2.5,
      edge: 4.5,
      confidence: 65,
      isPremium: true
    },
    {
      id: "685104",
      sport: "mlb",
      homeTeam: "LAD",
      awayTeam: "SD",
      startTime: `${todayDateStr}T02:10:00Z`, // 10:10 p.m. ET
      marketSpread: -1,
      predictedMargin: 1.3,
      edge: 2.3,
      confidence: 57,
      isPremium: true
    },
    {
      id: "685105",
      sport: "mlb",
      homeTeam: "SEA",
      awayTeam: "OAK",
      startTime: `${todayDateStr}T02:15:00Z`, // 10:15 p.m. ET
      marketSpread: -1.5,
      predictedMargin: 2.1,
      edge: 3.6,
      confidence: 61,
      isPremium: true
    },
    {
      id: "685106",
      sport: "mlb",
      homeTeam: "CLE",
      awayTeam: "KC",
      startTime: `${todayDateStr}T18:10:00Z`, // 2:10 p.m. ET
      marketSpread: -1,
      predictedMargin: 1.4,
      edge: 2.4,
      confidence: 58,
      isPremium: true
    },
    {
      id: "685107",
      sport: "mlb",
      homeTeam: "NYM",
      awayTeam: "ATL",
      startTime: `${todayDateStr}T19:10:00Z`, // 3:10 p.m. ET
      marketSpread: 1,
      predictedMargin: -0.7,
      edge: -1.7,
      confidence: 55,
      isPremium: true
    }
  ];
  
  return sampleGames;
}
