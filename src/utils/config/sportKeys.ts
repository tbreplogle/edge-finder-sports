
// Sport key mapping
export const SPORT_KEYS: Record<string, string> = {
  NFL: "americanfootball_nfl",
  NCAAF: "americanfootball_ncaaf",
  NCAAB: "basketball_ncaa", // Correct NCAAB endpoint
  MLB: "baseball_mlb"
};

export type SportKey = keyof typeof SPORT_KEYS;
export const DEFAULT_SPORT: SportKey = "NFL";
