
// This is an edge function to get MLB data for the admin preview dashboard
import { createClient } from '@supabase/supabase-js';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../utils/cors';

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
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('sport', 'MLB')
      .gte('game_date', dateStr)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return new Response(
      JSON.stringify({ 
        predictions,
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
