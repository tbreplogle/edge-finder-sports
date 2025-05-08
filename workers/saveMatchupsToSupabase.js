import { scrapeTodayMatchups } from './scrapeMatchupIds.js'
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js'

async function main() {
  if (!(await testConnection())) {
    console.error('Supabase connection failed'); process.exit(1)
  }
  try {
    const raw = await scrapeTodayMatchups()
    if (!raw.length) throw new Error('No matchups found')

    const cleaned = raw.map(r => ({
      matchup_id: r.matchup_id,
      game_id: r.game_id,
      away_team: r.away_team,
      home_team: r.home_team,
      game_date: r.game_date,
      away_team_id: r.away_team_id ?? null,
      home_team_id: r.home_team_id ?? null
    }))

    const { data, error } = await supabase.from('mlb_matchups').upsert(cleaned, { onConflict: ['matchup_id'] }).select()
    if (error) throw error

    createScrapeReport({ success: true, timestamp: new Date().toISOString(), stats: { matchups: data.length } })
    process.exit(0)
  } catch (err) {
    console.error(err.message)
    createScrapeReport({ success: false, error: err.message, timestamp: new Date().toISOString(), stats: { matchups: 0 } })
    process.exit(1)
  }
}

main()
