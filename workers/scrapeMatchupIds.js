import puppeteer from 'puppeteer'
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js'

const DEBUG = process.env.DEBUG === 'true'
const TZ = 'America/Chicago'

const TEAM_NAME_TO_ID = {
  'WASHINGTON': 24,
  'ATLANTA': 17,
  'TAMPA BAY': 9,
  'BOSTON': 29,
  'COLORADO': 22,
  'MILWAUKEE': 14,
  'KANSAS CITY': 11,
  'MINNESOTA': 10,
  'ST. LOUIS': 27,
  'CHI. CUBS': 16,
  'NY YANKEES': 8,
  'MIAMI': 6,
  'ATHLETICS': 7,
  'LA ANGELS': 4,
  'ARIZONA': 13,
  'CLEVELAND': 2,
  'CINCINNATI': 23,
  'PHILADELPHIA': 26,
  'TEXAS': 28,
  'DETROIT': 25,
  'HOUSTON': 19,
  'CHI. WHITE SOX': 15,
  'BALTIMORE': 30,
  'PITTSBURGH': 3,
  'SAN FRANCISCO': 12,
  'SAN DIEGO': 18,
  'LA DODGERS': 21,
  'SEATTLE': 1,
  'TORONTO': 5,
  'NY METS': 20
}

function safeParseDate(str) {
  try {
    const year = new Date().getFullYear()
    const dt = new Date(`${str} ${year}`)
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleDateString('en-CA', { timeZone: TZ })
    }
  } catch (_) { }
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

export async function scrapeTodayMatchups() {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: 'new' })
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080 })
  await page.setUserAgent('Mozilla/5.0')
  await page.goto('https://www.covers.com/sports/mlb/matchups', { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('a.matchup-btn-link', { timeout: 30000 })
  await page.waitForTimeout(1000)

  const raw = await page.$$eval('article.gamebox', games => games.map(game => {
    const link = game.querySelector('a.matchup-btn-link')
    const idMatch = link?.href.match(/\/matchup\/(\d+)$/)
    if (!idMatch) return null
    const teamsText = game.querySelector('strong.text-uppercase')?.innerText.trim().toUpperCase()
    if (!teamsText?.includes('@')) return null
    const [away_team, home_team] = teamsText.split('@').map(t => t.replace(/\u202F/g, ' ').trim())
    const dateText = game.querySelector('strong.preGame-status')?.innerText.trim() ?? ''
    return {
      game_id: idMatch[1],
      matchup_id: idMatch[1],
      away_team,
      home_team,
      raw_date_text: dateText
    }
  }).filter(Boolean))

  await browser.close()

  const final = raw.map(m => ({
    ...m,
    game_date: safeParseDate(m.raw_date_text)
  }))

  if (DEBUG) console.log(JSON.stringify(final, null, 2))
  return final
}

export async function scrapeAndSaveTodayMatchups() {
  if (!(await testConnection())) {
    console.error('Supabase connection failed')
    process.exit(1)
  }
  try {
    const matchups = await scrapeTodayMatchups()
    if (!matchups.length) {
      createScrapeReport({ success: false, error: 'No matchups found', timestamp: new Date().toISOString(), stats: { matchups: 0 } })
      return { success: false, error: 'No matchups found', matchups: [] }
    }
    const enriched = matchups.map(m => ({
      ...m,
      away_team_id: TEAM_NAME_TO_ID[m.away_team] ?? null,
      home_team_id: TEAM_NAME_TO_ID[m.home_team] ?? null
    }))
    const { data, error } = await supabase.from('mlb_matchups').upsert(enriched, { onConflict: ['matchup_id'] }).select()
    if (error) throw error
    createScrapeReport({ success: true, timestamp: new Date().toISOString(), stats: { matchups: data.length } })
    return { success: true, matchups: data }
  } catch (err) {
    console.error(err.message)
    createScrapeReport({ success: false, error: err.message, timestamp: new Date().toISOString(), stats: { matchups: 0 } })
    return { success: false, error: err.message, matchups: [] }
  }
}

if (import.meta.url.endsWith('scrapeMatchupIds.js')) {
  scrapeAndSaveTodayMatchups().then(() => process.exit(0)).catch(() => process.exit(1))
}
