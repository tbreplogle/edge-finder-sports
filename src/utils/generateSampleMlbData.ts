
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
      marketMoneyline: -150,
      marketImpliedPct: 0.60,
      predictedOdds: -160,
      predictedImpliedPct: 0.62,
      edgePct: 3.3,
      isPremium: false,
      isPreviewGame: true,
      isAdmin: false,
      isPaid: false,
      homeMarketMoneyline: -150,
      awayMarketMoneyline: +130,
      homePredictedOdds: -160,
      awayPredictedOdds: +140,
      homePredictedPct: 0.62,
      awayPredictedPct: 0.38
    },
    {
      id: "685101",
      sport: "mlb",
      homeTeam: "TOR",
      awayTeam: "BOS",
      startTime: `${todayDateStr}T22:07:00Z`, // 6:07 p.m. ET
      marketMoneyline: -120,
      marketImpliedPct: 0.545,
      predictedOdds: -130,
      predictedImpliedPct: 0.565,
      edgePct: 2.2,
      isPremium: true,
      isPreviewGame: false,
      isAdmin: false,
      isPaid: false,
      homeMarketMoneyline: -120,
      awayMarketMoneyline: +110,
      homePredictedOdds: -130,
      awayPredictedOdds: +120,
      homePredictedPct: 0.565,
      awayPredictedPct: 0.435
    },
    {
      id: "685102",
      sport: "mlb",
      homeTeam: "LAA",
      awayTeam: "DET",
      startTime: `${todayDateStr}T00:38:00Z`, // 8:38 p.m. ET
      marketMoneyline: 150,
      marketImpliedPct: 0.40,
      predictedOdds: 130,
      predictedImpliedPct: 0.435,
      edgePct: -2.3,
      isPremium: true,
      isPreviewGame: false,
      isAdmin: false,
      isPaid: false,
      homeMarketMoneyline: +150,
      awayMarketMoneyline: -170,
      homePredictedOdds: +130,
      awayPredictedOdds: -150,
      homePredictedPct: 0.435,
      awayPredictedPct: 0.565
    },
    {
      id: "685103",
      sport: "mlb",
      homeTeam: "SF",
      awayTeam: "COL",
      startTime: `${todayDateStr}T01:45:00Z`, // 9:45 p.m. ET
      marketMoneyline: -200,
      marketImpliedPct: 0.667,
      predictedOdds: -220,
      predictedImpliedPct: 0.688,
      edgePct: 4.5,
      isPremium: true,
      isPreviewGame: false,
      isAdmin: false,
      isPaid: false,
      homeMarketMoneyline: -200,
      awayMarketMoneyline: +180,
      homePredictedOdds: -220,
      awayPredictedOdds: +200,
      homePredictedPct: 0.688,
      awayPredictedPct: 0.312
    },
    {
      id: "685104",
      sport: "mlb",
      homeTeam: "LAD",
      awayTeam: "SD",
      startTime: `${todayDateStr}T02:10:00Z`, // 10:10 p.m. ET
      marketMoneyline: -110,
      marketImpliedPct: 0.524,
      predictedOdds: -120,
      predictedImpliedPct: 0.545,
      edgePct: 2.3,
      isPremium: true,
      isPreviewGame: false,
      isAdmin: false,
      isPaid: false,
      homeMarketMoneyline: -110,
      awayMarketMoneyline: +100,
      homePredictedOdds: -120,
      awayPredictedOdds: +110,
      homePredictedPct: 0.545,
      awayPredictedPct: 0.455
    },
    {
      id: "685105",
      sport: "mlb",
      homeTeam: "SEA",
      awayTeam: "OAK",
      startTime: `${todayDateStr}T02:15:00Z`, // 10:15 p.m. ET
      marketMoneyline: -180,
      marketImpliedPct: 0.643,
      predictedOdds: -200,
      predictedImpliedPct: 0.667,
      edgePct: 3.6,
      isPremium: true,
      isPreviewGame: false,
      isAdmin: false,
      isPaid: false,
      homeMarketMoneyline: -180,
      awayMarketMoneyline: +170,
      homePredictedOdds: -200,
      awayPredictedOdds: +190,
      homePredictedPct: 0.667,
      awayPredictedPct: 0.333
    },
    {
      id: "685106",
      sport: "mlb",
      homeTeam: "CLE",
      awayTeam: "KC",
      startTime: `${todayDateStr}T18:10:00Z`, // 2:10 p.m. ET
      marketMoneyline: -130,
      marketImpliedPct: 0.565,
      predictedOdds: -140,
      predictedImpliedPct: 0.583,
      edgePct: 2.4,
      isPremium: true,
      isPreviewGame: false,
      isAdmin: false,
      isPaid: false,
      homeMarketMoneyline: -130,
      awayMarketMoneyline: +120,
      homePredictedOdds: -140,
      awayPredictedOdds: +130,
      homePredictedPct: 0.583,
      awayPredictedPct: 0.417
    },
    {
      id: "685107",
      sport: "mlb",
      homeTeam: "NYM",
      awayTeam: "ATL",
      startTime: `${todayDateStr}T19:10:00Z`, // 3:10 p.m. ET
      marketMoneyline: 110,
      marketImpliedPct: 0.476,
      predictedOdds: 120,
      predictedImpliedPct: 0.455,
      edgePct: -1.7,
      isPremium: true,
      isPreviewGame: false,
      isAdmin: false,
      isPaid: false,
      homeMarketMoneyline: +110,
      awayMarketMoneyline: -120,
      homePredictedOdds: +120,
      awayPredictedOdds: -130,
      homePredictedPct: 0.455,
      awayPredictedPct: 0.545
    }
  ];
  
  return sampleGames;
}
