// workers/scrapeMatchupIds.js
import puppeteer from 'puppeteer'
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js'

const DEBUG = process.env.DEBUG === 'true'

/**
 * Scrape today’s MLB matchups from covers.com and return 
 * an array of { game_id, matchup_id, away_team, home_team, game_date }
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
  
  // wait for any one matchup button to appear, then give React a sec
  await page.waitForSelector('a.matchup-btn-link', { timeout: 30000 })
  await page.waitForTimeout(1000)
  
  // each <article class="mlb"> contains everything we need
  const matchups = await page.$$eval('article.mlb', articles =>
    articles.map(article => {
      // 1) matchup link + ID
      const link = article.querySelector('a.matchup-btn-link')
      if (!link) return null
      const m = link.href.match(/\/matchup\/(\d+)$/)
      if (!m) return null
      const matchup_id = m[1]
      const game_id = matchup_id
      
      // 2) “Away @ Home” header
      const header = article.querySelector('strong.text-uppercase')
      if (!header) return null
      const parts = header.innerText.trim().split('@').map(s => s.trim())
      if (parts.length !== 2) return null
      const [away_team, home_team] = parts
      
      // 3) Date
      const dateEl = article.querySelector('strong.preGame-status')
      let game_date = null
      if (dateEl) {
        const dateText = dateEl.innerText.trim()
        const dt = new Date(`${dateText} ${new Date().getFullYear()}`)
        if (!isNaN(dt)) {
          game_date = dt.toISOString().slice(0, 10)
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
 * Scrape & upsert into Supabase
 */
async function scrapeAndSaveTodayMatchups() {
  console.log('Starting MLB matchup scraper…')
  if (!(await testConnection())) {
    console.error('❌ Supabase connection failed, aborting.')
    process.exit(1)
  }

  try {
    const matchups = await scrapeTodayMatchups()
    if (matchups.length === 0) {
      console.warn('⚠️ No matchups found today — nothing to insert.')
      createScrapeReport({
        success: false,
        error: 'No matchups found',
        timestamp: new Date().toISOString(),
        stats: { matchups: 0 }
      })
      return { success: false, matchups: [] }
    }

    console.log(`→ Upserting ${matchups.length} records to Supabase…`)
    const { data, error } = await supabase
      .from('mlb_matchups')
      .upsert(matchups, { onConflict: ['matchup_id'] })
      .select()

    if (error) throw error

    console.log(`✅ Saved ${data.length} rows.`)
    createScrapeReport({
      success: true,
      timestamp: new Date().toISOString(),
      stats: { matchups: data.length },
      matchups: data
    })
    return { success: true, matchups: data }

  } catch (err) {
    console.error('❌ Error in scraper:', err.message)
    createScrapeReport({
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

// if run directly, fire off the save
if (import.meta.url.endsWith('scrapeMatchupIds.js')) {
  scrapeAndSaveTodayMatchups()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
