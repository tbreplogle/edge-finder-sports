// workers/scrapeMatchupIds.js
import puppeteer from 'puppeteer'
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js'

const DEBUG = process.env.DEBUG === 'true'

/**
 * 1) Scrape today’s MLB matchups from covers.com
 * 2) Return array of { game_id, matchup_id, away_team, home_team, game_date }
 */
async function scrapeTodayMatchups() {
  console.log('→ Launching browser and navigating to Covers.com MLB matchups…')
  const browser = await puppeteer.launch({
    args: ['--no-sandbox','--disable-setuid-sandbox'],
    headless: 'new'
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080 })
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'
  )

  await page.goto('https://www.covers.com/sports/mlb/matchups', {
    waitUntil: 'networkidle2',
    timeout: 60000
  })

  // wait for at least one matchup button + let React finish
  await page.waitForSelector('a.matchup-btn-link', { timeout: 30000 })
  await page.waitForTimeout(1000)

  const matchups = await page.$$eval('article.mlb', articles =>
    articles.map(article => {
      const link = article.querySelector('a.matchup-btn-link')
      if (!link) return null
      const m = link.href.match(/\/matchup\/(\d+)$/)
      if (!m) return null
      const matchup_id = m[1]
      const game_id    = matchup_id

      // parse “Away @ Home”
      const header = article.querySelector('strong.text-uppercase')
      if (!header) return null
      const parts = header.innerText.trim().split('@').map(s => s.trim())
      if (parts.length !== 2) return null
      const [away_team, home_team] = parts

      // parse date
      let game_date = null
      const dateEl = article.querySelector('strong.preGame-status')
      if (dateEl) {
        const dateText = dateEl.innerText.trim()
        const dt = new Date(`${dateText} ${new Date().getFullYear()}`)
        if (!isNaN(dt)) {
          game_date = dt.toISOString().slice(0,10)
        }
      }

      return { game_id, matchup_id, away_team, home_team, game_date }
    }).filter(x => x)
  )

  await browser.close()
  console.log(`→ Scraped ${matchups.length} matchups.`)
  if (DEBUG) console.log(JSON.stringify(matchups, null, 2))
  return matchups
}

/**
 * 1) Ensure Supabase connection
 * 2) Scrape today’s matchups
 * 3) Enrich each with home_team_id & away_team_id from teams_mlb
 * 4) Upsert into mlb_matchups
 */
async function scrapeAndSaveTodayMatchups() {
  console.log('Starting MLB matchup scraper…')
  if (!(await testConnection())) {
    console.error('❌ Supabase connection failed, aborting.')
    process.exit(1)
  }

  try {
    // 1) get raw matchups
    const matchups = await scrapeTodayMatchups()
    if (!matchups.length) {
      console.warn('⚠️ No matchups found today — nothing to insert.')
      await createScrapeReport({
        success: false,
        error: 'No matchups found',
        timestamp: new Date().toISOString(),
        stats: { matchups: 0 }
      })
      return { success: false, matchups: [] }
    }

    // 2) fetch team‑abbr → id map
    const { data: teams, error: teamErr } = await supabase
      .from('teams_mlb')
      .select('id, team_abbr')
    if (teamErr) throw teamErr
    const teamMap = Object.fromEntries(
      teams.map(t => [t.team_abbr.toUpperCase(), t.id])
    )

    // 3) attach the FK columns
    const enriched = matchups.map(m => ({
      ...m,
      away_team_id: teamMap[m.away_team.toUpperCase()] || null,
      home_team_id: teamMap[m.home_team.toUpperCase()] || null
    }))

    // 4) upsert into Supabase
    console.log(`→ Upserting ${enriched.length} records to Supabase…`)
    const { data, error } = await supabase
      .from('mlb_matchups')
      .upsert(enriched, { onConflict: ['matchup_id'] })
      .select()

    if (error) throw error

    console.log(`✅ Saved ${data.length} rows.`)
    await createScrapeReport({
      success: true,
      timestamp: new Date().toISOString(),
      stats: { matchups: data.length },
      matchups: data
    })
    return { success: true, matchups: data }

  } catch (err) {
    console.error('❌ Error in scraper:', err.message)
    await createScrapeReport({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
      stats: { matchups: 0 }
    })
    return { success: false, error: err.message, matchups: [] }
  }
}

// exports
export { scrapeTodayMatchups, scrapeAndSaveTodayMatchups }

// if run directly
if (import.meta.url.endsWith('scrapeMatchupIds.js')) {
  scrapeAndSaveTodayMatchups()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
