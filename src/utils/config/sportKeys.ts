// ---------------- sportKeys.ts ----------------
export const SPORT_KEYS = {
  NFL:   'americanfootball_nfl',
  NCAAF: 'americanfootball_ncaaf',
  NCAAB: 'basketball_ncaa',  // ✅ college hoops
  MLB:   'baseball_mlb'      // ✅ baseball
};

export type SportKey = keyof typeof SPORT_KEYS;
export const DEFAULT_SPORT: SportKey = 'NFL';
