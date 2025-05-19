
import { TickerData } from "@/utils/types/sports";

// Sample ticker data (fallback if API fails)
export const sampleTickerData: TickerData = {
  lastUpdated: new Date().toISOString(),
  days: [
    {
      label: "Yesterday",
      date: "2025-05-01",
      games: [
        {
          id: "nfl-1",
          home: "KC",
          away: "BAL",
          final: true,
          score_home: 24,
          score_away: 21,
          spread: -3,
          total: 44
        },
        {
          id: "nfl-2",
          home: "SF",
          away: "DAL",
          final: true,
          score_home: 28,
          score_away: 17,
          spread: -4.5,
          total: 46
        }
      ]
    },
    {
      label: "Today",
      date: "2025-05-02",
      games: [
        {
          id: "nfl-3",
          home: "BUF",
          away: "MIA",
          tip: "7:30 PM CT",
          spread: -6,
          consensus: 59,
          total: 45
        },
        {
          id: "nfl-4",
          home: "PHI",
          away: "NYG",
          tip: "8:00 PM CT",
          spread: -3.5,
          consensus: 67,
          total: 42
        }
      ]
    },
    {
      label: "Tomorrow",
      date: "2025-05-03",
      games: [
        {
          id: "nfl-5",
          home: "GB",
          away: "MIN",
          tip: "6:30 PM CT",
          spread: -1.5,
          consensus: 52,
          total: 48
        },
        {
          id: "nfl-6",
          home: "LAR",
          away: "ARI",
          tip: "7:00 PM CT",
          spread: -2,
          consensus: 61,
          total: 47
        }
      ]
    }
  ],
  games: [] // Empty array as current games will be set based on selected day
};
