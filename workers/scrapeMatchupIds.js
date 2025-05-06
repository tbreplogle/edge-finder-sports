// workers/scrapeMatchupIds.js

import puppeteer from 'puppeteer'
import { createScrapeReport } from './lib/supabaseClient.js'

const DEBUG = process.env.DEBUG === 'true'

/**
 * Scrapes today’s MLB matchup IDs from Covers.com
 * @returns {Promise<string[]>}
 */
export async function scrapeTodayMatchupIDs() {
  console.log("Starting to scrape today’s MLB matchup IDs…")
  const url = 'https://www.covers.com/sports/mlb/matchups'

  try {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new'
    })
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
    )

    console.log(`→ Navigating to ${url}`)
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
    if (DEBUG) await page.screenshot({ path: 'debug-matchups-page.png' })

    // make sure the new <article class="gamebox…"> wrappers are present
    await page.waitForSelector('article.gamebox.pregamebox', { timeout: 30000 })

    // grab every “Matchup” link under those
    const ids = await page.$$eval(
      'article.gamebox.pregamebox a.matchup-btn-link',
      els =>
        els
          .map((a) => {
            const m = a.href.match(/\/matchup\/(\d+)$/)
            return m ? m[1] : null
          })
          .filter((x) => x)
    )

    await browser.close()
    const unique = [...new Set(ids)]
    console.log(`→ Found ${unique.length} unique matchup IDs:`, unique)
    return unique
  } catch (err) {
    console.error("Error scraping matchup IDs:", err)
    createScrapeReport({
      success: false,
      error: `scrapeTodayMatchupIDs error: ${err.message}`,
      timestamp: new Date().toISOString(),
      stats: { matchups: 0 }
    })
    return []
  }
}

/**
 * Scrapes today’s full MLB matchups and upserts them into Supabase
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function scrapeAndSaveTodayMatchups(supabase) {
  console.log("Starting to scrape & save today’s MLB matchups…")
  const url = 'https://www.covers.com/sports/mlb/matchups'
  let browser, page

  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new'
    })
    page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
    )

    console.log(`→ Navigating to ${url}`)
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
    if (DEBUG) await page.screenshot({ path: 'debug-matchups-page.png' })

    // wait for the new article.gamebox wrappers
    await page.waitForSelector('article.gamebox.pregamebox', { timeout: 30000 })
    // give React a moment
    await page.waitForTimeout(1000)

    // how many games did we find?
    const count = await page.$$eval(
      'article.gamebox.pregamebox',
      (els) => els.length
    )
    console.log(`→ Found ${count} game containers`)

    // extract id, teams, date
    const matchups = await page.$$eval(
      'article.gamebox.pregamebox',
      (articles) =>
        articles
          .map((article) => {
            // 1) matchup_id from the action button
            const link = article.querySelector('a.matchup-btn-link')
            if (!link) return null
            const m = link.href.match(/\/matchup\/(\d+)$/)
            if (!m) return null
            const matchup_id = m[1]
            const game_id = matchup_id

            // 2) “Away @ Home” header
            const header = article.querySelector(
              'p.gamebox-header strong.text-uppercase'
            )
            if (!header) return null
            const txt = header.innerText.trim()
            if (!txt.includes('@')) return null
            const [away_team, home_team] = txt.split('@').map((s) => s.trim())

            // 3) game date
            const dateSpan =
              article.querySelector(
                'strong.preGame-status span.d-none.d-xl-inline'
              ) ||
              article.querySelector('strong.preGame-status span')
            const dateText = dateSpan?.innerText.trim()
            let game_date = null
            if (dateText) {
              const dt = new Date(
                `${dateText} ${new Date().getFullYear()}`
              )
              game_date = isNaN(dt) ? null : dt.toISOString().slice(0, 10)
            }

            return { game_id, matchup_id, away_team, home_team, game_date }
          })
          .filter((x) => x)
    )

    console.log(`→ Extracted ${matchups.length} matchups`)
    await page.close()
    await browser.close()

    if (matchups.length === 0) {
      console.warn('No matchups to save')
      createScrapeReport({
        success: false,
        error: 'No matchups found to save',
        timestamp: new Date().toISOString(),
        stats: { matchups: 0 }
      })
      return { success: false, matchups: [] }
    }

    console.log(`→ Upserting ${matchups.length} matchups into Supabase…`)
    const { data, error } = await supabase
      .from('mlb_matchups')
      .upsert(matchups, {
        onConflict: ['matchup_id'],
        ignoreDuplicates: false
      })
      .select()

    if (error) {
      console.error('Supabase upsert error:', error)
      createScrapeReport({
        success: false,
        error: `Supabase upsert failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        stats: { matchups: 0 }
      })
      return { success: false, matchups: [] }
    }

    console.log(`✅ Saved ${data.length} matchups`)
    createScrapeReport({
      success: true,
      timestamp: new Date().toISOString(),
      stats: { matchups: data.length },
      matchups: data
    })
    return { success: true, matchups: data }
  } catch (err) {
    console.error('Fatal error scraping & saving matchups:', err)
    createScrapeReport({
      success: false,
      error: `Fatal error: ${err.message}`,
      timestamp: new Date().toISOString(),
      stats: { matchups: 0 }
    })
    return { success: false, matchups: [] }
  } finally {
    if (page && !page.isClosed()) await page.close()
    if (browser) await browser.close()
  }
}

// If you ever want to run just the ID‐scraper from the CLI:
if (import.meta.url.endsWith('scrapeMatchupIds.js')) {
  scrapeTodayMatchupIDs()
    .then((ids) => {
      console.log("Today's matchup IDs:", ids)
      process.exit(0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
