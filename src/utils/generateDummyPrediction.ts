
/**
 * Create a deterministic but "random-looking" number so the same game_id
 * always produces the same dummy margin on the same day.
 */
function pseudoRandom(gameId: string, salt = 'v1') {
  let hash = 0;
  const str = gameId + salt + new Date().toDateString();
  
  // Simple string hash function for browsers
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Normalize to value between -1 and 1
  return (Math.abs(hash % 1000) / 1000) * 2 - 1;  // −1 → +1
}

export interface GameWithMarket {
  id: string;
  market_spread?: number | null;
  market_total?: number | null;
  home_team: string;
  away_team: string;
  [key: string]: any;
}

export interface GameWithPrediction extends GameWithMarket {
  predicted_margin: number;
  predicted_total: number | null;
  confidence_pct: number;
}

/**
 * Generate dummy predictions based on market odds
 */
export function dummyFromOdds(g: GameWithMarket): GameWithPrediction {
  // g.market_spread may be null (MLB money line handled separately)
  const market = Number(g.market_spread ?? 0);

  const wiggle = pseudoRandom(g.id) * 1.5;          // ±1.5 pts
  const predicted_margin = market + wiggle;

  // Total: if odds API returned one, nudge it; else null
  const total = g.market_total
      ? Number(g.market_total) + Math.round(pseudoRandom(g.id, 'tot') * 5)
      : null;

  return {
    ...g,
    predicted_margin,
    predicted_total: total,
    confidence_pct: 55 + Math.round(pseudoRandom(g.id, 'conf') * 5) // 50-60%
  };
}
