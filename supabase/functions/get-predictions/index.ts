
// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../utils/cors.ts";
import { supabaseAdmin } from "../utils/supabaseAdmin.ts";
import { rateLimit } from "../utils/rateLimit.ts";

// Define the shape of the game data we'll work with
interface GameData {
  id: string;
  sport: string;
  sportTitle: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  spread: number;
  predictedMargin: number;
  edge: number;
  consensus?: number;
  total?: number;
  isPreviewGame?: boolean;
  startTime?: string;
}

const ODDS_API_KEY = "ca659a5203c1cfc6a0275ebd54c57262";

// Sport key mapping
const SPORT_KEYS: Record<string, string> = {
  nfl: "americanfootball_nfl",
  ncaaf: "americanfootball_ncaaf",
  nba: "basketball_nba",
  ncaab: "basketball_ncaab",
  mlb: "baseball_mlb"
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Apply rate limiting (10 requests per minute)
    const rateLimitResult = await rateLimit(req, 10);
    if (!rateLimitResult.success) {
      return new Response(JSON.stringify({
        error: "Too many requests"
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Parse request body
    const { sport = "nfl", featureOne = false } = await req.json();
    
    // Get client IP for analytics
    const clientIP = req.headers.get("x-forwarded-for") || "unknown";
    
    // Get auth user if available
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    let userRole = "guest";
    
    if (authHeader) {
      // Extract token
      const token = authHeader.replace('Bearer ', '');
      
      // Verify with Supabase Auth
      const supabase = supabaseAdmin();
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        userId = user.id;
        
        // Get user role from metadata
        if (user.user_metadata?.is_admin === true) {
          userRole = "admin";
        } else if (user.user_metadata?.role) {
          userRole = user.user_metadata.role;
        }
      }
    }
    
    // Fetch odds data from the API
    const sportKey = SPORT_KEYS[sport as keyof typeof SPORT_KEYS] || 'basketball_nba';
    
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?regions=us&markets=spreads&dateFormat=iso&apiKey=${ODDS_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    const gamesData = await response.json();
    
    // Transform the data
    let transformedGames: GameData[] = gamesData.map((game: any, index: number) => {
      // Find the first bookmaker with a spreads market
      const bookmaker = game.bookmakers.find((bm: any) => 
        bm.markets.some((market: any) => market.key === 'spreads')
      );
      
      // Extract the spread
      let spread = 0;
      if (bookmaker) {
        const spreadsMarket = bookmaker.markets.find((m: any) => m.key === 'spreads');
        if (spreadsMarket) {
          const homeOutcome = spreadsMarket.outcomes.find((o: any) => o.name === game.home_team);
          if (homeOutcome && typeof homeOutcome.point === 'number') {
            spread = homeOutcome.point;
          }
        }
      }
      
      // Generate simulated prediction data
      // In a real app, this would come from your proprietary models
      const predictedMargin = spread + (Math.random() * 10 - 5); // Simulated prediction
      const edge = predictedMargin - spread;
      const consensus = Math.floor(Math.random() * 30) + 50; // Random 50-80% consensus
      
      return {
        id: game.id,
        sport,
        sportTitle: game.sport_title,
        homeTeam: getTeamAbbreviation(game.home_team),
        awayTeam: getTeamAbbreviation(game.away_team),
        commenceTime: game.commence_time,
        startTime: game.commence_time,
        spread,
        predictedMargin: parseFloat(predictedMargin.toFixed(1)),
        edge: parseFloat(edge.toFixed(1)),
        consensus,
        total: Math.floor(Math.random() * 40) + 180, // Random total between 180-220
        isPreviewGame: index === 0 && userRole === "guest" // First game is preview for guests
      };
    });
    
    // If we're just looking for one featured game
    if (featureOne && transformedGames.length > 0) {
      transformedGames = transformedGames.sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge));
      return new Response(
        JSON.stringify(transformedGames[0]),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Return the appropriate response
    return new Response(
      JSON.stringify({
        data: transformedGames,
        userRole,
        generatedDate: new Date().toLocaleDateString('en-US', { 
          month: '2-digit',
          day: '2-digit',
          year: 'numeric'
        }),
        refreshTime: "08:00 AM CT"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    // Handle errors
    console.error("Error in get-predictions function:", error);
    
    return new Response(
      JSON.stringify({
        error: "An error occurred while fetching predictions",
        details: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

// Helper to get abbreviations for team names
function getTeamAbbreviation(teamName: string): string {
  // This is a simplified version - in a real app, you'd have a complete mapping
  const teamMap: Record<string, string> = {
    // NBA
    'Milwaukee Bucks': 'MIL',
    'Indiana Pacers': 'IND',
    'Denver Nuggets': 'DEN',
    'Los Angeles Lakers': 'LAL',
    'Golden State Warriors': 'GS',
    'Houston Rockets': 'HOU',
    'Boston Celtics': 'BOS',
    'New York Knicks': 'NYK',
    'Phoenix Suns': 'PHX',
    'Dallas Mavericks': 'DAL',
    'Philadelphia 76ers': 'PHI',
    'Miami Heat': 'MIA',
    
    // NFL
    'Kansas City Chiefs': 'KC',
    'San Francisco 49ers': 'SF',
    'Dallas Cowboys': 'DAL',
    'Buffalo Bills': 'BUF',
    'Philadelphia Eagles': 'PHI',
    'Baltimore Ravens': 'BAL',
    
    // Add more mappings as needed
  };
  
  return teamMap[teamName] || teamName.split(' ').pop()?.substring(0, 3).toUpperCase() || teamName.substring(0, 3).toUpperCase();
}
