import puppeteer from 'puppeteer'
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js'

const DEBUG = process.env.DEBUG === 'true'

const TEAM_ALT_NAME_TO_ID = {
  SEATTLE: 1, CLEVELAND: 2, PITTSBURGH: 3, 'LA ANGELS': 4, TORONTO: 5, MIAMI: 6, ATHLETICS: 7,
  'NY YANKEES': 8, 'TAMPA BAY': 9, MINNESOTA: 10, 'KANSAS CITY': 11, 'SF GIANTS': 12,
  'SAN FRANCISCO': 12, ARIZONA: 13, MILWAUKEE: 14, 'CHI. WHITE SOX': 15, 'CHI. CUBS': 16,
  ATLANTA: 17, 'SAN DIEGO': 18, HOUSTON: 19, 'NY METS': 20, 'LA DODGERS': 21, COLORADO: 22,
  CINCINNATI: 23, WASHINGTON: 24, DETROIT: 25, PHILADELPHIA: 26, 'ST. LOUIS': 27,
  TEXAS: 28, BOSTON: 29, BALTIMORE: 30
}

async function scrapePitchingMatchups() {
  const today = new Date().toISOString().slice(0, 10)
  const { data: games, error: fetchErr } = await supabase
    .from('mlb_matchups')
    .select('matchup_id')
    .eq('game_date', today)

  if (fetchErr) throw new Error(fetchErr.message)
  if (!games.length) return []

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: 'new' })
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080 })
  await page.setUserAgent('Mozilla/5.0')

  const rows = []

  for (const { matchup_id } of games) {
    const url = `https://www.covers.com/sport/baseball/mlb/matchup/${matchup_id}`
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('a[href="#away-team-last-5"]', { timeout: 30000 })

    for (const role of ['away', 'home']) {
      const tab = role === 'away' ? '#away-team-last-5' : '#home-team-last-5'
      let team_name = null, team_id = null

      try {
        team_name = await page.$eval(`a[href="${tab}"]`, el => el.innerText.trim().toUpperCase())
        team_id = TEAM_ALT_NAME_TO_ID[team_name] ?? null
      } catch (_) { }

      let pitcher_name = null
      try {
        pitcher_name = await page.$eval(`${tab} a.anchor-with-border`, el => el.innerText.trim())
      } catch (_) {
        pitcher_name = 'TBD'
      }

      const trHandles = await page.$$(`${tab} table tr`)
      let statRow = null
      for (const tr of trHandles) {
        try {
          const txt = await tr.$eval('td b', b => b.innerText.trim().toLowerCase())
          if (txt.includes('last') && txt.includes('avg')) { statRow = tr; break }
        } catch (_) { }
      }

      let ip = null, h = null, r = null, er = null, so = null, bb = null, hr = null, pit = null, pip = null, gbfb = null, era = null, era_plus = null, whip = null

      if (statRow) {
        const allB = await statRow.$$eval('td b', bs => bs.map(b => b.innerText.trim()))
        if (allB.length >= 11) {
          [ , ip, h, r, er, so, bb, hr, pit, pip, gbfb ] = allB.map(v => v.replace(/[^\d.]/g, ''))
          ip = parseFloat(ip) || 0
          h = parseFloat(h) || 0
          r = parseFloat(r) || 0
          er = parseFloat(er) || 0
          so = parseFloat(so) || 0
          bb = parseFloat(bb) || 0
          hr = parseFloat(hr) || 0
          pit = parseFloat(pit) || 0
          pip = parseFloat(pip) || 0
          gbfb = parseFloat(gbfb) || 0
          era = ip > 0 ? +(er / ip * 9).toFixed(2) : null
          era_plus = era ? Math.round(100 * (4.1 / era)) : null
          whip = ip > 0 ? +(((bb + h) / ip).toFixed(3)) : null
        }
      }

      rows.push({
        matchup_id,
        pitcher_role: role,
        team_name,
        team_id,
        pitcher_name,
        ip, h, r, er, so, bb, hr, pit, pip, gbfb,
        era, era_plus, whip
      })
    }
  }

  await browser.close()
  if (DEBUG) console.log(JSON.stringify(rows, null, 2))
  return rows
}

export async function scrapeAndSavePitchingMatchups() {
  if (!(await testConnection())) { console.error('Supabase connection failed'); process.exit(1) }

  try {
    const stats = await scrapePitchingMatchups()
    if (!stats.length) throw new Error('No pitching stats found')
    const { data, error } = await supabase.from('pitching_matchups').upsert(stats, { onConflict: ['matchup_id', 'pitcher_role'] }).select()
    if (error) throw error
    createScrapeReport({ success: true, timestamp: new Date().toISOString(), stats: { records: data.length } })
  } catch (err) {
    createScrapeReport({ success: false, error: err.message, timestamp: new Date().toISOString(), stats: { records: 0 } })
  }
}

if (import.meta.url.endsWith('scrapePitchingMatchups.js')) {
  scrapeAndSavePitchingMatchups().then(() => process.exit(0)).catch(() => process.exit(1))
}
