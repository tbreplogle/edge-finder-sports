
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { supabaseAdmin } from '../utils/supabaseAdmin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const requestData = await req.json().catch(() => ({}));
    const { gameId, topMovers } = requestData;
    
    // Get query params (for direct URLs)
    const url = new URL(req.url);
    const queryGameId = url.searchParams.get('gameId');
    const queryTopMovers = url.searchParams.get('topMovers') === 'true';
    
    // Use either body or query param for gameId and topMovers
    const finalGameId = gameId || queryGameId;
    const showTopMovers = topMovers || queryTopMovers;
    
    // Initialize Supabase client
    const supabase = supabaseAdmin();
    
    // Handle top movers request
    if (showTopMovers) {
      console.log('Fetching top movers');
      
      const { data: lineDeltas, error: deltaError } = await supabase
        .from('line_delta')
        .select('game_id, delta_spread, delta_total, curr_spread, curr_total, open_spread, open_total')
        .order('abs(delta_spread)', { ascending: false })
        .limit(6);
      
      if (deltaError) {
        console.error('Error fetching top movers:', deltaError);
        throw new Error(`Error fetching top movers: ${deltaError.message}`);
      }

      if (!lineDeltas || lineDeltas.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            topMovers: []
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
      
      // Get additional game info for each top mover
      const enhancedData = await Promise.all(
        lineDeltas.map(async (mover) => {
          const { data: gameData } = await supabase
            .from('line_moves')
            .select('sport')
            .eq('game_id', mover.game_id)
            .order('ts', { ascending: false })
            .limit(1)
            .single();
            
          // Get team names from the most recent line_moves entry
          const { data: recentMove } = await supabase
            .from('line_moves')
            .select('home_team, away_team')
            .eq('game_id', mover.game_id)
            .order('ts', { ascending: false })
            .limit(1)
            .single();
          
          return {
            ...mover,
            sport: gameData?.sport || 'unknown',
            home_team: recentMove?.home_team || 'Home Team',
            away_team: recentMove?.away_team || 'Away Team',
            movement_pts: Math.abs(mover.delta_spread || 0)
          };
        })
      );
      
      return new Response(
        JSON.stringify({
          success: true,
          topMovers: enhancedData
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
    
    // Handle single game request
    if (!finalGameId) {
      return new Response(
        JSON.stringify({ 
          error: 'Game ID is required when not requesting top movers' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }
    
    // First, get the delta summary from materialized view
    const { data: deltaSummary, error: deltaError } = await supabase
      .from('line_delta')
      .select('*')
      .eq('game_id', finalGameId)
      .maybeSingle();
    
    if (deltaError) {
      console.error('Error fetching delta summary:', deltaError);
    }
    
    // Then get the full history
    const { data: movements, error: movementsError } = await supabase
      .from('line_moves')
      .select('*')
      .eq('game_id', finalGameId)
      .order('ts');
    
    if (movementsError) {
      return new Response(
        JSON.stringify({ 
          error: movementsError.message 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: deltaSummary || null,
        movements: movements || [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
