
## Data Pipeline

The application's data pipeline consists of the following components:

### MLB Data Collection
1. **MLB Matchup IDs** - Daily scrape of MLB matchups from Covers.com to get matchup_ids and game information
   * Script: `workers/getMlbMatchupIds.js`
   * Schedule: Daily at 7 AM CT
   * Output: `mlb_matchups` table

2. **MLB Team Hitting Stats** - Regular scrape of team hitting statistics
   * Script: `workers/scrapeTeamHittingStats.js`
   * Schedule: Daily at 7:30 AM CT
   * Output: `mlb_team_hitting_stats` table

3. **MLB Pitching Matchups** - Detailed pitching matchup information
   * Script: `workers/scrapePitchingMatchups.js`
   * Schedule: Daily at 8 AM CT
   * Output: `pitching_matchups` table

4. **MLB Market Odds** - Latest moneyline odds from sportsbooks
   * Script: `workers/fetchMlbOdds.js`
   * Schedule: Daily at 8 AM CT
   * Output: `mlb_market_odds` table

5. **MLB Predictions** - Generate MLB predictions based on team and pitcher data
   * Script: Models run in R via workers
   * Schedule: Daily at 9 AM CT
   * Output: `mlb_predictions` table

### Other Sports (Coming Soon)
* NFL data pipeline
* NCAAF data pipeline
* NCAAB data pipeline
