// workers/scrapePitchingMatchups.js
import puppeteer from 'puppeteer'
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js'

const DEBUG = process.env.DEBUG === 'true'

/**
 * alt_name → team_id  (from your teams_mlb.alt_name)
 */
const TEAM_ALT_NAME_TO_ID = {
  'SEATTLE':            1,
  'CLEVELAND':          2,
  'PITTSBURGH':         3,
  'LA ANGELS':          4,
  'LOS ANGELES ANGELS': 4,
  'TORONTO':            5,
  'MIAMI':              6,
  'ATHLETICS':          7,
  'NY YANKEES':         8,
  'TAMPA BAY':          9,
  'MINNESOTA':         10,
  'KANSAS CITY':       11,
  'SF GIANTS':         12,
  'SAN FRANCISCO':     12,
  'ARIZONA':           13,
  'MILWAUKEE':         14,
  'CHI. WHITE SOX':    15,
  'CHI. CUBS':         16,
  'ATLANTA':           17,
  'SAN DIEGO':         18,
  'HOUSTON':           19,
  'NY METS':           20,
  'LA DODGERS':        21,
  'LOS ANGELES DODGERS':21,
  'COLORADO':          22,
  'CINCINNATI':        23,
  'WASHINGTON':        24,
  'DETROIT':           25,
  'PHILADELPHIA':      26,
  'ST. LOUIS':         27,
  'TEXAS':             28,
  'BOSTON':            29,
  'BALTIMORE':         30
}

async function scrapePitchingMatchups() {
  // 1) load today’s matchups
  const today = new Date().toISOString().slice(0, 10)
  const { data: games, error: loadErr } = await supabase
    .from('mlb_matchups')
    .select('matchup_id')
    .eq('game_date', today)

  if (loadErr) throw loadErr
  if (!games.length) {
    console.log('⚠️ No matchups for today.')
    return []
  }
  console.log(`→ Found ${games.length} games to scrape.`)

  // 2) start puppeteer
  const browser = await puppeteer.launch({
    args: ['--no-sandbox','--disable-setuid-sandbox'],
    headless: 'new'
  })
  const page = await browser.newPage()
  await page.setViewport({ width:1920, height:1080 })
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')

  const stats = []

  // 3) for each matchup, scrape both sides
  for (const { matchup_id } of games) {
    const url = `https://www.covers.com/sport/baseball/mlb/matchup/${matchup_id}`
    console.log(`→ Loading ${url}`)
    await page.goto(url, { waitUntil:'networkidle2', timeout:60000 })
    await page.waitForSelector('a[href="#away-team-last-5"]', { timeout:30000 })

    // helper to scrape one side
    async function scrapeSide(side) {
      const role = side === 'away' ? 'away' : 'home'

      // team name (alt_name)
      const team_name = await page.$eval(
        `a[href="#${side}-team-last-5"]`,
        el => el.innerText.trim().toUpperCase()
      )

      // pitcher name
      const pitcher_name = await page.$eval(
        `#${side}-team-last-5 a.anchor-with-border`,
        el => el.innerText.trim()
      )

      // grab Last 5 Avg row
      const vals = await page.$$eval(
        `#${side}-team-last-5 table tr`,
        trs => {
          const row = trs.find(r => {
            const b = r.querySelector('td b')
            return b && b.innerText.trim().startsWith('Last 5 Avg')
          })
          if (!row) return []
          return Array.from(row.querySelectorAll('td b'))
            .map(b => b.innerText.trim())
            .slice(1)
        }
      )

      if (vals.length !== 10) {
        console.warn(`⚠️ ${role} stats missing for matchup ${matchup_id}`)
        if (DEBUG) console.debug(`${role} extracted:`, vals)
        return
      }

      // leave as strings so numeric columns accept decimals
      const [ ip, h, r, er, so, bb, hr, pit, pip, gbfb ] = vals

      stats.push({
        matchup_id,
        pitcher_role: role,
        team_name,
        pitcher_name,
        ip, h, r, er, so, bb, hr, pit, pip, gbfb
      })
    }

    await scrapeSide('away')
    await scrapeSide('home')
  }

  await browser.close()

  // 4) map team_name → away_team_id/home_team_id
  const withIds = stats.map(row => {
    const tid = TEAM_ALT_NAME_TO_ID[row.team_name] ?? null
    if (row.pitcher_role === 'away') row.away_team_id = tid
    else                          row.home_team_id = tid
    return row
  })

  console.log(`→ Scraped ${withIds.length} pitching records`)
  if (DEBUG) console.debug(withIds)
  return withIds
}

export async function scrapeAndSavePitchingMatchups() {
  console.log('⏳ Starting pitching‑matchups scraper…')
  if (!(await testConnection())) process.exit(1)

  try {
    let rows = await scrapePitchingMatchups()
    if (!rows.length) {
      console.warn('⚠️ No pitching stats to insert')
      createScrapeReport({
        success:   false,
        error:     'No pitching stats found',
        timestamp: new Date().toISOString(),
        stats:     { records: 0 }
      })
      return
    }

    // 5) compute ERA, ERA+ & WHIP
    rows = rows.map(r => {
      const ipVal = parseFloat(r.ip)  || 0
      const erVal = parseFloat(r.er)  || 0
      const hVal  = parseFloat(r.h)   || 0
      const bbVal = parseFloat(r.bb)  || 0

      r.era      = ipVal > 0 ? +((erVal / ipVal) * 9).toFixed(2) : null
      r.era_plus = r.era   ? +(100 * (4.1 / r.era)).toFixed(0) : null
      r.whip     = ipVal > 0 ? +(((bbVal + hVal) / ipVal)).toFixed(3) : null
      return r
    })

    // 6) upsert into your Supabase table
    console.log(`→ Upserting ${rows.length} records to Supabase…`)
    const { data, error } = await supabase
      .from('pitching_matchups')
      .upsert(rows, { onConflict: ['matchup_id','pitcher_role'] })
      .select()

    if (error) throw error

    console.log(`✅ Saved ${data.length} pitching records`)
    createScrapeReport({
      success:   true,
      timestamp: new Date().toISOString(),
      stats:     { records: data.length }
    })
  }
  catch (err) {
    console.error('❌ Error inserting pitching stats:', err)
    createScrapeReport({
      success:   false,
      error:     err.message,
      timestamp: new Date().toISOString(),
      stats:     { records: 0 }
    })
  }
}

// auto‑run when invoked directly
if (import.meta.url.endsWith('scrapePitchingMatchups.js')) {
  scrapeAndSavePitchingMatchups()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
