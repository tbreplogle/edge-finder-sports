
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitizePredictions } from "../utils/sanitize.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create a Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    let userRole = 'guest'; // Default role is guest (anonymous)
    let userId = null;
    
    // If user is authenticated, fetch their role
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
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

    // In a real implementation, you would fetch this data from a database
    // For now, we'll return the mock data that's currently in the Dashboard
    const { sport } = await req.json();

    const mockGames = [
      {
        id: "nfl-1",
        sport: "nfl",
        homeTeam: "Chiefs",
        awayTeam: "Raiders",
        startTime: "2025-05-01T19:00:00",
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
        startTime: "2025-05-01T16:25:00",
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
        startTime: "2025-05-01T13:00:00",
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
        startTime: "2025-05-01T15:30:00",
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
        startTime: "2025-05-01T12:00:00",
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
        startTime: "2025-05-01T21:00:00",
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
        startTime: "2025-05-01T19:10:00",
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
    ].filter(game => game.sport === sport);

    // Sanitize the predictions based on user role
    const sanitizedGames = sanitizePredictions(mockGames, userRole);

    return new Response(JSON.stringify({ 
      data: sanitizedGames,
      userRole: userRole 
    }), {
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      }
    });
  }
});
