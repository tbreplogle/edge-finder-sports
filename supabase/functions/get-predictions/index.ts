
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitizePredictions } from "../utils/sanitize.ts";
import { seedGames } from "../utils/seed.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPORTS = [
  { key: 'nfl', script: 'predict_nfl.R', csv: '/tmp/nfl.csv' },
  { key: 'ncaaf', script: 'predict_ncaaf.R', csv: '/tmp/ncaaf.csv' },
  { key: 'ncaab', script: 'predict_ncaab.R', csv: '/tmp/ncaab.csv' },
  { key: 'mlb', script: 'predict_mlb.R', csv: '/tmp/mlb.csv' }
];

// Simple in-memory rate limiter
const rateLimiter = {
  ipRequests: new Map<string, { count: number, resetTime: number }>(),
  limit: 100, // Max requests per window
  windowMs: 60 * 60 * 1000, // 1-hour window
  
  isRateLimited(ip: string): boolean {
    const now = Date.now();
    const record = this.ipRequests.get(ip);
    
    // If no record exists or window has expired, create a new record
    if (!record || now > record.resetTime) {
      this.ipRequests.set(ip, { count: 1, resetTime: now + this.windowMs });
      return false;
    }
    
    // Increment request count
    record.count += 1;
    
    // Check if over limit
    return record.count > this.limit;
  },
  
  getRemainingRequests(ip: string): number {
    const record = this.ipRequests.get(ip);
    if (!record) return this.limit;
    return Math.max(0, this.limit - record.count);
  }
};

// Data validation function
function validatePrediction(game: any): boolean {
  // Check for valid prediction values (prevent unreasonable numbers)
  if (game.predictedMargin !== null && Math.abs(game.predictedMargin) > 100) {
    console.warn(`Data quality issue: predictedMargin out of bounds: ${game.predictedMargin} for game ${game.id}`);
    return false;
  }
  
  if (game.marketSpread !== null && Math.abs(game.marketSpread) > 100) {
    console.warn(`Data quality issue: marketSpread out of bounds: ${game.marketSpread} for game ${game.id}`);
    return false;
  }
  
  if (game.edge !== null && Math.abs(game.edge) > 50) {
    console.warn(`Data quality issue: edge out of bounds: ${game.edge} for game ${game.id}`);
    return false;
  }
  
  if (game.confidence !== null && (game.confidence < 0 || game.confidence > 100)) {
    console.warn(`Data quality issue: confidence out of bounds: ${game.confidence} for game ${game.id}`);
    return false;
  }
  
  return true;
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    
    // Check rate limit for non-authenticated requests
    const authHeader = req.headers.get('Authorization');
    const isAuthenticated = authHeader && authHeader.startsWith('Bearer ');
    
    if (!isAuthenticated && rateLimiter.isRateLimited(ip)) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded. Please try again later.',
        retryAfter: '1 hour' 
      }), {
        status: 429,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(Date.now() + 3600000).toISOString()
        }
      });
    }

    // Create a Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get authorization header
    let userRole = 'guest'; // Default role is guest (anonymous)
    let userId = null;
    
    // If user is authenticated, fetch their role
    if (isAuthenticated) {
      const token = authHeader!.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        userId = user.id;
        // Get user role from metadata or profile
        userRole = user.user_metadata?.role || 'free';
        
        // If user is an admin, set admin role
        if (user.user_metadata?.is_admin === true) {
          userRole = 'admin';
        }
      }
    }

    console.log(`User role: ${userRole}, User ID: ${userId || 'anonymous'}`);

    // Get the requested sport from request body
    const { sport } = await req.json();

    // Get today's date in America/Chicago timezone
    const today = new Date();
    // Format as ISO string and then extract date portion 
    const chicagoDate = today.toLocaleDateString('en-US', { 
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit'
    });
    
    console.log(`Generating predictions for ${sport} on ${chicagoDate}`);

    // In a real implementation, these would be fetched from a database
    // where they were stored by a daily prediction generation job that runs at 8:00 AM CT
    let mockGames = [];
    
    // Check if we should have games today based on the sport season
    // This simulates our daily prediction generation job
    const inSeason = checkIfInSeason(sport, today);
    const isDev = Deno.env.get('ENVIRONMENT') === 'development';
    
    if (inSeason) {
      mockGames = generateMockGames(sport, today);
    } else if (isDev) {
      // For development environments, always return seed data so UI can be tested
      const seedGame = seedGames.find(game => game.sport === sport.toLowerCase());
      if (seedGame) {
        mockGames = [seedGame];
        console.log(`Returning seed data for ${sport} in development environment`);
      }
    }

    // Apply data quality validation
    const validGames = mockGames.filter(validatePrediction);
    if (validGames.length !== mockGames.length) {
      console.warn(`Filtered out ${mockGames.length - validGames.length} games that failed data validation`);
    }

    // Sanitize the predictions based on user role
    const sanitizedGames = sanitizePredictions(validGames, userRole);

    // Add rate limit headers for non-authenticated users
    const headers = { ...corsHeaders, 'Content-Type': 'application/json' };
    if (!isAuthenticated) {
      headers['X-RateLimit-Limit'] = rateLimiter.limit.toString();
      headers['X-RateLimit-Remaining'] = rateLimiter.getRemainingRequests(ip).toString();
    }

    return new Response(JSON.stringify({ 
      data: sanitizedGames,
      userRole: userRole,
      generatedDate: chicagoDate,
      refreshTime: "08:00 AM CT"
    }), {
      headers
    });

  } catch (error) {
    console.error('Error in get-predictions function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      }
    });
  }
});

// Check if a sport is in season based on the current date
function checkIfInSeason(sport: string, date: Date): boolean {
  const month = date.getMonth() + 1; // JavaScript months are 0-indexed
  
  switch (sport.toLowerCase()) {
    case 'nfl':
      // NFL: September (9) through January (1)
      return month >= 9 || month <= 1;
    case 'ncaaf':
      // NCAAF: September (9) through January (1)
      return month >= 9 || month <= 1;
    case 'ncaab':
      // NCAAB: November (11) through April (4)
      return month >= 11 || month <= 4;
    case 'mlb':
      // MLB: April (4) through October (10)
      return month >= 4 && month <= 10;
    default:
      return true; // Default to in-season if sport is not recognized
  }
}

// Generate mock games for the given sport
function generateMockGames(sport: string, date: Date) {
  // This simulates what our daily job would generate and store in the database
  const baseGames = [
    {
      id: "nfl-1",
      sport: "nfl",
      homeTeam: "Chiefs",
      awayTeam: "Raiders",
      startTime: new Date(date).toISOString(),
      marketSpread: -7.5,
      predictedMargin: -9.2,
      edge: 1.7,
      confidence: 65,
      rawFactors: {
        home_offense_rank: 3,
        home_defense_rank: 8,
        away_offense_rank: 22,
        away_defense_rank: 14,
        home_field_advantage: 2.5,
        injuries_impact: -0.5
      }
    },
    {
      id: "nfl-2",
      sport: "nfl",
      homeTeam: "Eagles",
      awayTeam: "Cowboys",
      startTime: new Date(date).toISOString(),
      marketSpread: -3,
      predictedMargin: -6.5,
      edge: 3.5,
      confidence: 72,
      isPremium: true,
      rawFactors: {
        home_offense_rank: 5,
        home_defense_rank: 7,
        away_offense_rank: 2,
        away_defense_rank: 15,
        home_field_advantage: 2.5,
        injuries_impact: -0.2
      }
    },
    {
      id: "nfl-3",
      sport: "nfl",
      homeTeam: "Packers",
      awayTeam: "Bears",
      startTime: new Date(date).toISOString(),
      marketSpread: -6,
      predictedMargin: -4.2,
      edge: -1.8,
      confidence: 58,
      rawFactors: {
        home_offense_rank: 8,
        home_defense_rank: 12,
        away_offense_rank: 18,
        away_defense_rank: 10,
        home_field_advantage: 2.5,
        injuries_impact: -1.0
      }
    },
    {
      id: "ncaaf-1",
      sport: "ncaaf",
      homeTeam: "Georgia",
      awayTeam: "Alabama",
      startTime: new Date(date).toISOString(),
      marketSpread: -4.5,
      predictedMargin: -7.8,
      edge: 3.3,
      confidence: 68,
      isPremium: true,
      rawFactors: {
        home_offense_rank: 2,
        home_defense_rank: 1,
        away_offense_rank: 3,
        away_defense_rank: 5,
        home_field_advantage: 3.0,
        recruitment_class_diff: 0.5
      }
    },
    {
      id: "ncaaf-2",
      sport: "ncaaf",
      homeTeam: "Ohio State",
      awayTeam: "Michigan",
      startTime: new Date(date).toISOString(),
      marketSpread: -2.5,
      predictedMargin: -1.3,
      edge: -1.2,
      confidence: 55,
      isPremium: true,
      rawFactors: {
        home_offense_rank: 4,
        home_defense_rank: 6,
        away_offense_rank: 7,
        away_defense_rank: 2,
        home_field_advantage: 3.0,
        recruitment_class_diff: -0.2
      }
    },
    {
      id: "ncaab-1",
      sport: "ncaab",
      homeTeam: "Duke",
      awayTeam: "UNC",
      startTime: new Date(date).toISOString(),
      marketSpread: -3,
      predictedMargin: -6.2,
      edge: 3.2,
      confidence: 70,
      isPremium: true,
      rawFactors: {
        home_offense_efficiency: 118.5,
        home_defense_efficiency: 95.2,
        away_offense_efficiency: 115.8,
        away_defense_efficiency: 97.3,
        tempo_adjustment: 1.2
      }
    },
    {
      id: "mlb-1",
      sport: "mlb",
      homeTeam: "Dodgers",
      awayTeam: "Giants",
      startTime: new Date(date).toISOString(),
      marketSpread: -1.5,
      predictedMargin: -2.8,
      edge: 1.3,
      confidence: 63,
      isPremium: true,
      rawFactors: {
        home_starting_pitcher_era: 2.85,
        away_starting_pitcher_era: 3.75,
        home_batting_average: 0.265,
        away_batting_average: 0.248,
        ballpark_factor: 102
      }
    },
  ];
  
  // Filter to only return games for the requested sport
  return baseGames.filter(game => game.sport === sport.toLowerCase());
}
