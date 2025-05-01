
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
    
    // Use either body or query param for gameId
    const finalGameId = gameId || queryGameId;
    
    // Initialize Supabase client
    const supabase = supabaseAdmin();
    
    // Handle top movers request
    if (topMovers) {
      const { data: topMoversData, error: topMoversError } = await supabase
        .from('line_delta')
        .select('game_id, delta_spread, delta_total, curr_spread, curr_total, open_spread, open_total')
        .order('delta_spread', { ascending: false })
        .limit(6);
      
      if (topMoversError) {
        throw new Error(`Error fetching top movers: ${topMoversError.message}`);
      }
      
      // Get additional game info for each top mover
      if (topMoversData && topMoversData.length > 0) {
        const enhancedData = await Promise.all(
          topMoversData.map(async (mover) => {
            const { data: gameData } = await supabase
              .from('line_moves')
              .select('sport, game_id')
              .eq('game_id', mover.game_id)
              .limit(1)
              .single();
              
            // Get team names from the API
            try {
              const { data: teamsData } = await supabase.functions.invoke('get-predictions', {
                body: { gameIdsOnly: true, gameIds: [mover.game_id] }
              });
              
              const gameInfo = teamsData?.data?.find(g => g.id === mover.game_id);
              
              return {
                ...mover,
                sport: gameData?.sport || 'unknown',
                home_team: gameInfo?.homeTeam || 'Home Team',
                away_team: gameInfo?.awayTeam || 'Away Team',
                movement_pts: Math.abs(mover.delta_spread)
              };
            } catch (e) {
              console.error('Error getting team names:', e);
              return {
                ...mover,
                sport: gameData?.sport || 'unknown',
                home_team: 'Home Team',
                away_team: 'Away Team',
                movement_pts: Math.abs(mover.delta_spread)
              };
            }
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
    
    // Handle single game request
    if (!finalGameId) {
      return new Response(
        JSON.stringify({ 
          error: 'Game ID is required' 
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
