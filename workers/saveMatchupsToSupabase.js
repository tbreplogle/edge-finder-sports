import { scrapeTodayMatchups } from './scrapeMatchupIds.js'
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js'

async function main() {
  if (!(await testConnection())) {
    console.error('Supabase connection failed')
    process.exit(1)
  }
  try {
    const matchups = await scrapeTodayMatchups()
    if (!matchups.length) throw new Error('No matchups found')
    const { data, error } = await supabase.from('mlb_matchups').upsert(matchups, { onConflict: ['matchup_id'] }).select()
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
