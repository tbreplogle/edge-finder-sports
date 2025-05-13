
// This is an edge function to get MLB data for the admin preview dashboard
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../utils/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the current date
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    // Fetch the latest MLB predictions
    const { data: predictions, error: predictionsError } = await supabase
      .from('predictions')
      .select('*')
      .eq('sport', 'MLB')
      .gte('game_date', dateStr)
      .order('updated_at', { ascending: false });

    if (predictionsError) throw predictionsError;
    
    // Fetch the team hitting stats (including team_id)
    const { data: teamHittingStats, error: teamHittingError } = await supabase
      .from('mlb_team_hitting_stats')
      .select('*')
      .order('team_name', { ascending: true });
      
    if (teamHittingError) throw teamHittingError;

    return new Response(
      JSON.stringify({ 
        predictions,
        teamHittingStats,
        timestamp: new Date().toISOString(),
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        },
        status: 500
      }
    );
  }
});
