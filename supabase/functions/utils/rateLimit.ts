
// Simple in-memory rate limiter for edge functions
// In production, this should use Redis or another persistent store

const MINUTE = 60 * 1000; // 60 seconds in milliseconds
const requestLog: Map<string, number[]> = new Map();

/**
 * Simple rate limiter for edge functions
 * @param key The key to rate limit on (usually IP address)
 * @param limit Maximum number of requests allowed per minute
 * @returns boolean True if rate limited, false otherwise
 */
export async function rateLimit(key: string, limit: number): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - MINUTE;
  
  // Get existing requests for this key
  const requests = requestLog.get(key) || [];
  
  // Filter to requests within the current minute
  const recentRequests = requests.filter(timestamp => timestamp > windowStart);
  
  // Add current request
  recentRequests.push(now);
  requestLog.set(key, recentRequests);
  
  // Check if over limit
  return recentRequests.length > limit;
}
