
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
  
  // Convert probability to American odds for the home team
  let homeOdds;
  if (homeProbability > 0.5) {
    // Favorite: odds to win $100
    homeOdds = Math.round(-100 / (homeProbability - 0.5) - 100);
  } else {
    // Underdog: odds on a $100 bet
    homeOdds = Math.round((1 - homeProbability) / homeProbability * 100);
  }
  
  // Calculate away team odds (opposite of home)
  let awayOdds;
  if (homeProbability < 0.5) {
    // Away team is favorite
    awayOdds = Math.round(-100 / ((1 - homeProbability) - 0.5) - 100);
  } else {
    // Away team is underdog
    awayOdds = Math.round(homeProbability / (1 - homeProbability) * 100);
  }
  
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
    home_prob: homeProbability,
    home_ml: homeOdds,
    away_ml: awayOdds,
    // Include the moneyline values from the API if available
    market_home_ml: matchup.moneyline,
    market_away_ml: matchup.moneyline_opponent
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
        
        // Calculate edge for moneyline odds
        let edge = 0;
        if (row.market_home_ml && row.home_ml) {
          // Calculate edge as market ML - predicted ML
          // For betting on home team
          edge = row.market_home_ml - row.home_ml;
        }
        
        await importCsvRow({
          sport: 'MLB',
          game_id: row.game_id,
          home_team: row.home_team,
          away_team: row.away_team,
          predicted_margin: row.predicted_margin,
          predicted_total: null,
          confidence_pct: Math.round(row.home_prob * 100),
          home_ml: row.home_ml,
          away_ml: row.away_ml,
          market_home_ml: row.market_home_ml,
          market_away_ml: row.market_away_ml,
          edge: edge,
          date: new Date().toISOString().split('T')[0] // Today's date in YYYY-MM-DD format
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
