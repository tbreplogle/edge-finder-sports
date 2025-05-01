
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import axios from 'https://esm.sh/axios@1.6.2';
import { SPORT_KEYS } from '../../functions/utils/config/sportKeys.ts';

// Constants and configuration
const sports = ['NFL', 'NCAAF', 'NCAAB', 'MLB']; 
const ODDS_API_URL = 'https://api.the-odds-api.com/v4/sports';
const ODDS_API_KEY = Deno.env.get('ODDS_API_KEY') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function snapSport(sport: string, supabase: any) {
  try {
    console.log(`[Line Tracker] Starting snapshot for ${sport}...`);
    const sportKey = SPORT_KEYS[sport as keyof typeof SPORT_KEYS];
    
    if (!sportKey) {
      console.error(`[Line Tracker] Invalid sport key: ${sport}`);
      return;
    }

    const { data } = await axios.get(`${ODDS_API_URL}/${sportKey}/odds`, {
      params: {
        regions: 'us',
        markets: sportKey.includes('baseball') ? 'h2h,totals' : 'spreads,totals',
        oddsFormat: 'american',
        apiKey: ODDS_API_KEY,
        dateFormat: 'iso'
      },
      timeout: 10000
    });

    if (!data || !Array.isArray(data)) {
      console.error(`[Line Tracker] Invalid response data for ${sport}`);
      return;
    }

    console.log(`[Line Tracker] Received ${data.length} games for ${sport}`);
    const now = new Date().toISOString();
    const rows = [];

    for (const ev of data) {
      if (!ev.bookmakers || !ev.bookmakers.length) continue;
      
      const bk = ev.bookmakers[0];
      if (!bk) continue;

      const isBaseball = sportKey.includes('baseball');
      const spread = !isBaseball 
        ? bk.markets.find((m: any) => m.key === 'spreads')
        : null;
      const total = bk.markets.find((m: any) => m.key === 'totals');

      let homeSpread = null;
      if (spread) {
        const homeOutcome = spread.outcomes.find((o: any) => o.name === ev.home_team);
        homeSpread = homeOutcome?.point ?? null;
      }

      const gameTotal = total?.outcomes?.[0]?.point ?? null;

      // Skip if we don't have valid data
      if (isBaseball || homeSpread === null) continue;

      // Insert the snapshot into the database
      rows.push(
        supabase
          .from('line_moves')
          .insert({
            sport: sport,
            game_id: ev.id,
            ts: now,
            spread_home: homeSpread,
            total: gameTotal
          })
          .select()
      );
    }

    const results = await Promise.all(rows);
    const insertedCount = results.filter(r => !r.error).length;
    console.log(`[Line Tracker] Inserted ${insertedCount}/${rows.length} snapshots for ${sport}`);
    
    return insertedCount;
  } catch (error) {
    console.error(`[Line Tracker] Error fetching ${sport}:`, error);
    return 0;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      { auth: { persistSession: false } }
    );

    // Start timer for performance tracking
    const startTime = Date.now();
    console.log(`[Line Tracker] Starting line movement snapshot at ${new Date().toISOString()}`);

    // Capture snapshots for each sport
    const snapResults = [];
    for (const sport of sports) {
      const count = await snapSport(sport, supabase);
      snapResults.push({ sport, count });
    }

    // Refresh the materialized view
    await supabase.rpc('refresh_line_delta');
    console.log(`[Line Tracker] Refreshed materialized view`);

    // Calculate execution time
    const duration = Date.now() - startTime;
    console.log(`[Line Tracker] Completed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        snapshots: snapResults,
        duration
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error(`[Line Tracker] Error:`, error);
    
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
