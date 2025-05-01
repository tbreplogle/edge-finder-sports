
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
    // Parse request params
    const url = new URL(req.url);
    const gameId = url.searchParams.get('gameId');
    
    if (!gameId) {
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
    
    // Get line movements for the game
    const supabase = supabaseAdmin();
    
    // First, get the delta summary from materialized view
    const { data: deltaSummary, error: deltaError } = await supabase
      .from('line_delta')
      .select('*')
      .eq('game_id', gameId)
      .maybeSingle();
    
    if (deltaError) {
      console.error('Error fetching delta summary:', deltaError);
    }
    
    // Then get the full history
    const { data: movements, error: movementsError } = await supabase
      .from('line_moves')
      .select('*')
      .eq('game_id', gameId)
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
