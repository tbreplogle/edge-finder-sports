// workers/scrapePitchingMatchups.js
import puppeteer from 'puppeteer'
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js'

const DEBUG = process.env.DEBUG === 'true'

// exact Covers.com “alt_name” → your teams_mlb.team_id
const TEAM_ALT_NAME_TO_ID = {
  'SEATTLE':             1,
  'CLEVELAND':           2,
  'PITTSBURGH':          3,
  'LA ANGELS':           4,
  'LOS ANGELES ANGELS':  4,
  'TORONTO':             5,
  'MIAMI':               6,
  'ATHLETICS':           7,
  'NY YANKEES':          8,
  'TAMPA BAY':           9,
  'MINNESOTA':          10,
  'KANSAS CITY':        11,
  'SF GIANTS':          12,
  'SAN FRANCISCO GIANTS':12,
  'ARIZONA':            13,
  'MILWAUKEE':          14,
  'CHI. WHITE SOX':     15,
  'CHI. CUBS':          16,
  'ATLANTA':            17,
  'SAN DIEGO':          18,
  'HOUSTON':            19,
  'NY METS':            20,
  'LA DODGERS':         21,
  'LOS ANGELES DODGERS':21,
  'COLORADO':           22,
  'CINCINNATI':         23,
  'WASHINGTON':         24,
  'DETROIT':            25,
  'PHILADELPHIA':       26,
  'ST. LOUIS':          27,
  'TEXAS':              28,
  'BOSTON':             29,
  'BALTIMORE':          30
}

// safe parse‑to‑float
function toFloat(str) {
  const n = parseFloat(str)
  return isNaN(n) ? null : n
}

async function scrapePitchingMatchups() {
  // 1) load today’s matchups from Supabase
  const today = new Date().toISOString().slice(0,10)
  const { data: games, error: loadErr } = await supabase
    .from('mlb_matchups')
    .select('matchup_id')
    .eq('game_date', today)

  if (loadErr) {
    console.error('❌ Could not load today’s matchups:', loadErr)
    throw loadErr
  }
  if (!games.length) {
    console.log('⚠️  No matchups for today.')
    return []
  }
  console.log(`→ Found ${games.length} games to scrape.`)

  // 2) spin up Puppeteer
  const browser = await puppeteer.launch({
    args: ['--no-sandbox','--disable-setuid-sandbox'],
    headless: 'new'
  })
  const page = await browser.newPage()
  await page.setViewport({ width:1920, height:1080 })
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')

  const rows = []

  // 3) scrape each game
  for (const { matchup_id } of games) {
    const url = `https://www.covers.com/sport/baseball/mlb/matchup/${matchup_id}`
    console.log(`→ Loading ${url}`)
    await page.goto(url, { waitUntil:'networkidle2', timeout:60000 })
    await page.waitForSelector('a[href="#away-team-last-5"]', { timeout:30000 })

    // helper to grab one side (prefix = "away" or "home")
    async function scrapeSide(prefix, role) {
      // team label
      const label = await page.$eval(
        `a[href="#${prefix}-team-last-5"]`,
        el => el.innerText.trim().toUpperCase()
      )
      const team_id = TEAM_ALT_NAME_TO_ID[label]
      if (!team_id) {
        console.warn(`⚠️ No team_id mapping for "${label}"`)
        return
      }

      // pitcher name
      const pitcher_name = await page.$eval(
        `#${prefix}-team-last-5 a.anchor-with-border`,
        el => el.innerText.trim()
      )

      // find the “Last 5 Avg.” row and pull its 10 <b> values
      const vals = await page.$$eval(
        `#${prefix}-team-last-5 table tr`,
        trs => {
          const tr = trs.find(r=>
            r.querySelector('td b')?.innerText.trim() === 'Last 5 Avg.'
          )
          if (!tr) return []
          return Array.from(tr.querySelectorAll('td b'))
            .map(b=>b.innerText.trim())
            .slice(1)  // drop the first <b> “Last 5 Avg.”
        }
      )

      if (vals.length !== 10) {
        console.warn(`⚠️ ${role} stats missing for matchup ${matchup_id}`)
        return
      }

      const [
        rawIp, rawH, rawR, rawEr,
        rawSo, rawBb, rawHr, rawPit,
        rawPip, rawGbfb
      ] = vals

      // push one row
      rows.push({
        matchup_id,
        pitcher_role: role,
        team_name:    label,
        team_id,
        pitcher_name,

        // preserve decimals exactly as shown on Covers.com
        ip:   toFloat(rawIp),
        h:    toFloat(rawH),
        r:    toFloat(rawR),
        er:   toFloat(rawEr),
        so:   toFloat(rawSo),
        bb:   toFloat(rawBb),
        hr:   toFloat(rawHr),
        pit:  toFloat(rawPit),
        pip:  toFloat(rawPip),
        gbfb: toFloat(rawGbfb)
      })
    }

    await scrapeSide('away','away')
    await scrapeSide('home','home')
  }

  await browser.close()
  console.log(`→ Scraped ${rows.length} pitcher‑records`)
  if (DEBUG) console.log(JSON.stringify(rows,null,2))
  return rows
}

export async function scrapeAndSavePitchingMatchups() {
  console.log('⏳ Starting pitching‑matchups scraper…')
  if (!(await testConnection())) {
    console.error('❌ Supabase connection failed, aborting.')
    process.exit(1)
  }

  try {
    const stats = await scrapePitchingMatchups()
    if (!stats.length) {
      console.warn('⚠️ No pitching stats to insert')
      createScrapeReport({
        success:   false,
        error:     'No pitching stats found',
        timestamp: new Date().toISOString(),
        stats:     { records: 0 }
      })
      return
    }

    // 4) compute ERA, ERA+ & WHIP
    const enriched = stats.map(r => {
      const ip = r.ip  || 0
      const h  = r.h   || 0
      const er = r.er  || 0
      const bb = r.bb  || 0

      const era     = ip>0 ? parseFloat(((er/ip)*9).toFixed(2)) : null
      const era_plus= era  ? parseFloat((100*(4.1/era)).toFixed(0))  : null
      const whip    = ip>0 ? parseFloat(((bb+h)/ip).toFixed(3))      : null

      return { ...r, era, era_plus, whip }
    })

    console.log(`→ Upserting ${enriched.length} records to Supabase…`)
    const { data, error } = await supabase
      .from('pitching_matchups')
      .upsert(enriched, { onConflict:['matchup_id','pitcher_role'] })
      .select()

    if (error) throw error
    console.log(`✅ Saved ${data.length} pitching records`)
    createScrapeReport({
      success:   true,
      timestamp: new Date().toISOString(),
      stats:     { records: data.length },
      records:   data
    })
  }
  catch(err) {
    console.error('❌ Error inserting pitching stats:', err)
    createScrapeReport({
      success:   false,
      error:     err.message,
      timestamp: new Date().toISOString(),
      stats:     { records: 0 }
    })
  }
}

// auto‑run when called directly
if (import.meta.url.endsWith('scrapePitchingMatchups.js')) {
  scrapeAndSavePitchingMatchups()
    .then(()=>process.exit(0))
    .catch(()=>process.exit(1))
}
