
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../utils/cors.ts";
import { supabaseAdmin } from "../utils/supabaseAdmin.ts";
import { SPORT_KEYS } from "../../src/utils/config/sportKeys.ts";

// Define function to check if a user is an admin
const isAdmin = async (token: string) => {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      return false;
    }
    
    return data.user.user_metadata?.is_admin === true;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
};

// Function to fetch games from the Odds API
async function fetchGames(sport: string) {
  const ODDS_API_KEY = Deno.env.get("ODDS_API_KEY") || "ca659a5203c1cfc6a0275ebd54c57262";
  const sportKey = SPORT_KEYS[sport];
  const isBaseball = sportKey.includes("baseball");
  const markets = isBaseball ? "h2h,totals" : "spreads,totals";
  
  try {
    const response = await fetch(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=${markets}&dateFormat=iso&oddsFormat=american`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch games: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching games:", error);
    throw error;
  }
}

// Function to save predictions to the database
async function savePredictions(predictions: any[], sport: string) {
  const supabase = supabaseAdmin();
  const timestamp = new Date().toISOString();
  
  const rows = predictions.map(p => ({
    game_id: p.game_id,
    sport: sport.toLowerCase(),
    predicted_margin: p.predicted_margin,
    predicted_total: p.predicted_total,
    confidence_pct: p.confidence_pct,
    created_at: timestamp,
    updated_at: timestamp
  }));
  
  // Use upsert to insert or update predictions
  const { data, error } = await supabase
    .from("predictions")
    .upsert(rows, { onConflict: "game_id,sport" })
    .select();
    
  if (error) {
    console.error("Error saving predictions:", error);
    throw error;
  }
  
  return data?.length || 0;
}

// Function to execute user code in a sandboxed environment
function executeCode(code: string, games: any[]) {
  try {
    // Create a safe context to run the code
    const context = {
      games,
      console: {
        log: (...args: any[]) => console.log(...args),
        error: (...args: any[]) => console.error(...args)
      },
      setTimeout,
      clearTimeout,
      exports: {},
      module: { exports: {} }
    };
    
    // Execute the code with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Code execution timed out (5s)")), 5000);
    });
    
    const executionPromise = new Promise<any[]>((resolve, reject) => {
      try {
        // Add export default support
        const wrappedCode = `
          ${code}
          
          // Handle both export default and module.exports
          if (typeof predict === 'function') {
            exports.result = predict(games);
          } else if (typeof module.exports === 'function') {
            exports.result = module.exports(games);
          } else if (typeof module.exports === 'object' && typeof module.exports.default === 'function') {
            exports.result = module.exports.default(games);
          } else {
            throw new Error("No valid predict function found. Export a function named 'predict' or use 'export default' or 'module.exports'.");
          }
        `;
        
        // Use Function constructor to create a sandboxed environment
        const sandboxedFn = new Function(...Object.keys(context), wrappedCode);
        
        // Execute the sandboxed function
        sandboxedFn(...Object.values(context));
        
        // Check if result exists and is an array
        if (!context.exports.result || !Array.isArray(context.exports.result)) {
          reject(new Error("The predict function must return an array"));
          return;
        }
        
        // Validate the result format
        const invalidItem = context.exports.result.find((item: any) => 
          typeof item !== 'object' || 
          !item.game_id || 
          typeof item.predicted_margin !== 'number' ||
          typeof item.predicted_total !== 'number' ||
          typeof item.confidence_pct !== 'number'
        );
        
        if (invalidItem) {
          reject(new Error("Each prediction must include game_id, predicted_margin, predicted_total, and confidence_pct"));
          return;
        }
        
        resolve(context.exports.result);
      } catch (error) {
        reject(error);
      }
    });
    
    // Race between execution and timeout
    return Promise.race([executionPromise, timeoutPromise]);
  } catch (error) {
    console.error("Error executing code:", error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    // Get the Authorization header
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    
    // Check if the user is an admin
    const adminStatus = await isAdmin(token);
    if (!adminStatus) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Admin access required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Parse the request body
    const { sport, code } = await req.json();
    
    if (!sport || !code) {
      return new Response(
        JSON.stringify({ error: "Sport and code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Fetch games for the selected sport
    const games = await fetchGames(sport);
    
    if (!games || !Array.isArray(games)) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch games" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Execute the code
    const predictions = await executeCode(code, games);
    
    // Save the predictions
    const inserted = await savePredictions(predictions, sport);
    
    // Return success response
    return new Response(
      JSON.stringify({ success: true, inserted }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in edge function:", error);
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
