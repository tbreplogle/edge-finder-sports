
// Import necessary modules
const axios = require('axios');
const { pullTeamStats, buildTodayMatchups } = require('./fetchMlbFeatures');
const { importCsvRow } = require('./importCsv');

// Polyfill for path module to make node modules work in this context
const path = {
  join: (...paths) => paths.join('/')
};

// Inline the prediction logic to avoid Node.js import issues with ESM
function predictMatchup(matchup, teamStats) {
  const home = teamStats[matchup.home] || { HR: 0, HRA: 0, BA: 0, team: matchup.home };
  const away = teamStats[matchup.away] || { HR: 0, HRA: 0, BA: 0, team: matchup.away };
  
  // Pitcher adjustment factors
  const homePitcherFactor = matchup.pitcher_home ? 
    (matchup.pitcher_home.ERAplus / 100) * (2 - Math.min(1.5, matchup.pitcher_home.WHIP)) : 1;
  
  const awayPitcherFactor = matchup.pitcher_away ? 
    (matchup.pitcher_away.ERAplus / 100) * (2 - Math.min(1.5, matchup.pitcher_away.WHIP)) : 1;
  
  // Base offensive strength 
  const homeOffense = (home.HR * 1.5 + home.BA * 1000) * homePitcherFactor;
  const awayOffense = (away.HR * 1.5 + away.BA * 1000) * awayPitcherFactor;
  
  // Base defensive weakness
  const homeDefense = home.HRA * 1.2;
  const awayDefense = away.HRA * 1.2;
  
  // Home field advantage - roughly 4% in MLB
  const homeAdvantage = 1.04;
  
  // Calculate final strength indicators
  const homeStrength = homeOffense + awayDefense;
  const awayStrength = awayOffense + homeDefense;
  
  // Apply home field advantage
  const adjustedHomeStrength = homeStrength * homeAdvantage;
  
  // Calculate win probability for home team
  const totalStrength = adjustedHomeStrength + awayStrength;
  const homeProbability = adjustedHomeStrength / totalStrength;
  
  // Convert to a run margin with some randomness (MLB typical margin is ~1.5-2 runs)
  const marginFactor = 4.5; // Tunable parameter
  const rawMargin = (homeProbability - 0.5) * marginFactor;
  
  // Round to 1 decimal place
  const predictedMargin = Math.round(rawMargin * 10) / 10;
  
  return {
    game_id: matchup.game_id,
    home_team: matchup.home,
    away_team: matchup.away,
    predicted_margin: predictedMargin,
    home_prob: homeProbability
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
    
    for (const m of games) {
      try {
        const row = predictMatchup(m, teamMap);
        await importCsvRow({
          sport: 'MLB',
          game_id: row.game_id,
          home_team: row.home_team,
          away_team: row.away_team,
          predicted_margin: row.predicted_margin,
          predicted_total: null,
          confidence_pct: Math.round(row.home_prob * 100)
        });
        processedCount++;
      } catch (err) {
        console.error(`Error processing game ${m.game_id}:`, err);
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
