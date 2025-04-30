
import { corsHeaders } from "../_shared/cors.ts";
import { seedGames } from "../utils/seed.ts";
import { validatePrediction } from "../utils/sanitize.ts";
import { rateLimit } from "../utils/rateLimit.ts";

interface RequestOptions {
  sport?: string;
  featureOne?: boolean;
}

Deno.serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Check if rate limited
  const ip = req.headers.get('x-real-ip') || 'unknown';
  const rateLimited = await rateLimit(ip, 20); // Limit to 20 requests per minute
  
  if (rateLimited) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 429
    });
  }

  try {
    // Parse request to get filters
    const { sport = null, featureOne = false } = await req.json() as RequestOptions;

    // Simulate today's date in Chicago time
    const chicagoTime = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });
    const today = new Date(chicagoTime);
    
    // Generate today's games - in real life this would fetch from a database
    // We're simulating that our games were generated at 8:00 AM Chicago time
    today.setHours(8, 0, 0, 0); 
    const generatedDate = today.toISOString();

    // Filter games by sport if requested
    let games = seedGames;
    if (sport) {
      games = games.filter(game => game.sport.toLowerCase() === sport.toLowerCase());
    }

    // If featureOne is true, just return the game with the highest absolute edge
    if (featureOne) {
      if (games.length === 0) {
        return new Response(JSON.stringify([]), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }
      
      // Sort by absolute edge value and get the highest
      const featuredGame = [...games]
        .sort((a, b) => Math.abs((b.edge || 0)) - Math.abs((a.edge || 0)))
        .filter(game => validatePrediction(game))[0];
      
      return new Response(JSON.stringify(featuredGame || []), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Validate predictions
    const validGames = games.filter(game => validatePrediction(game));
    
    // Return all games with generated date
    return new Response(
      JSON.stringify({ 
        games: validGames,
        generatedAt: generatedDate,
        timezone: "America/Chicago",
        count: validGames.length
      }), 
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});
