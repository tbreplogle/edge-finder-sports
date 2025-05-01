
// Import necessary modules
const axios = require('axios');
const { pullTeamStats, buildTodayMatchups } = require('./fetchMlbFeatures');
const { importCsvRow } = require('./importCsv');

// Polyfill for path module to make node modules work in this context
const path = {
  join: (...paths) => paths.join('/')
};

// Inline the prediction logic to avoid Node.js import issues with ESM
function rawRating(t, p) {
  if (!p) {
    // Default values if pitcher stats are not available
    return (
      56.74 +
      0.108  * t.HR  -
      0.0934 * t.HRA +
      334.9  * t.BA
    );
  }
  
  return (
    56.74 +
    0.108  * t.HR  -
    0.0934 * t.HRA +
    334.9  * t.BA  +
    0.188  * p.ERAplus -
    61.98  * p.WHIP
  );
}

function scalePct(rating, isHome) {
  const base = rating / 162;
  const pct  = ((base * 14) + 0.5) / 15;      // ((x*(15-1)+.5)/15)
  return pct * (isHome ? 1.02 : 0.98);        // HFA tweak
}

function predictMatchup(m, map) {
  const Rhome = rawRating(map[m.home] || { HR: 0, HRA: 0, BA: 0, team: m.home }, m.pitcher_home);
  const Raway = rawRating(map[m.away] || { HR: 0, HRA: 0, BA: 0, team: m.away }, m.pitcher_away);

  const Phome = scalePct(Rhome, /*isHome=*/true);
  const Paway = scalePct(Raway, false);

  const awayProb = (Paway - Paway*Phome) / (Paway + Phome - 2*Paway*Phome);
  const homeProb = 1 - awayProb;

  return {
    sport: 'MLB',
    game_id: m.game_id,
    home_team: m.home,
    away_team: m.away,
    predicted_margin: +((Rhome - Raway)/10).toFixed(1),
    predicted_total: null,
    confidence_pct: Math.round(homeProb*100)
  };
}

async function runMlb() {
  console.log("Starting MLB prediction process...");
  
  try {
    console.log("Fetching team statistics...");
    const teamMap = await pullTeamStats();
    
    console.log("Building today's matchups...");
    const games = await buildTodayMatchups();
    
    console.log(`Processing ${games.length} MLB matchups...`);
    let processedCount = 0;
    
    for (const g of games) {
      try {
        const row = predictMatchup(g, teamMap);
        
        await importCsvRow(row);
        processedCount++;
      } catch (err) {
        console.error(`Error processing game ${g.game_id}:`, err);
      }
    }
    
    console.log(`MLB prediction complete: Pulled ${Object.keys(teamMap).length} team rows, ${games.length} matchups, processed ${processedCount} predictions.`);
  } catch (error) {
    console.error("Failed to run MLB predictions:", error);
  }
}

// Export the function for use in other modules
async function runPredictions() {
  console.log("Starting prediction updates at", new Date().toISOString());
  
  try {
    // Run MLB predictions
    await runMlb();
    
    console.log("All prediction updates completed successfully");
  } catch (error) {
    console.error("Error in prediction updates:", error);
    process.exit(1);
  }
}

// If this script is run directly, execute the update
if (require.main === module) {
  runPredictions().catch(err => {
    console.error("Fatal error in prediction script:", err);
    process.exit(1);
  });
}

module.exports = { runMlb, runPredictions };
