// workers/scrapePitchingMatchups.js
import puppeteer from 'puppeteer'
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js'

const DEBUG = process.env.DEBUG === 'true'

// Covers.com “alt_name” → your teams_mlb.team_id
const TEAM_ALT_NAME_TO_ID = {
  'SEATTLE':              1,
  'CLEVELAND':            2,
  'PITTSBURGH':           3,
  'LA ANGELS':            4,
  'LOS ANGELES ANGELS':   4,
  'TORONTO':              5,
  'MIAMI':                6,
  'ATHLETICS':            7,
  'NY YANKEES':           8,
  'TAMPA BAY':            9,
  'MINNESOTA':           10,
  'KANSAS CITY':         11,
  'SF GIANTS':           12,
  'SAN FRANCISCO':       12,
  'ARIZONA':             13,
  'MILWAUKEE':           14,
  'CHI. WHITE SOX':      15,
  'CHI. CUBS':           16,
  'ATLANTA':             17,
  'SAN DIEGO':           18,
  'HOUSTON':             19,
  'NY METS':             20,
  'LA DODGERS':          21,
  'LOS ANGELES DODGERS': 21,
  'COLORADO':            22,
  'CINCINNATI':          23,
  'WASHINGTON':          24,
  'DETROIT':             25,
  'PHILADELPHIA':        26,
  'ST. LOUIS':           27,
  'TEXAS':               28,
  'BOSTON':              29,
  'BALTIMORE':           30
}

function toFloat(s) {
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

async function scrapePitchingMatchups() {
  // 1. load today's matchup IDs
  const today = new Date().toISOString().slice(0,10)
  const { data: games, error: loadErr } = await supabase
    .from('mlb_matchups')
    .select('matchup_id')
    .eq('game_date', today)

  if (loadErr) throw loadErr
  if (!games.length) {
    console.log('⚠️ No matchups found for today')
    return []
  }
  console.log(`→ Found ${games.length} matchups to scrape`)

  // 2. launch Puppeteer
  const browser = await puppeteer.launch({
    args: ['--no-sandbox','--disable-setuid-sandbox'],
    headless: 'new'
  })
  const page = await browser.newPage()
  await page.setViewport({ width:1920, height:1080 })
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')

  const rows = []

  // 3. iterate each matchup
  for (const { matchup_id } of games) {
    const url = `https://www.covers.com/sport/baseball/mlb/matchup/${matchup_id}`
    console.log(`→ Loading ${url}`)
    await page.goto(url, { waitUntil:'networkidle2', timeout:60000 })
    await page.waitForSelector('a[href="#away-team-last-5"]', { timeout:30000 })

    // helper: scrape one side
    async function scrapeSide(side) {
      const role = side === 'away' ? 'away' : 'home'
      // team label
      const label = await page.$eval(
        `a[href="#${side}-team-last-5"]`,
        el => el.innerText.trim().toUpperCase()
      )
      const team_id = TEAM_ALT_NAME_TO_ID[label]
      if (!team_id) {
        console.warn(`⚠️ No team_id mapping for "${label}"`)
        return
      }

      // pitcher name
      const pitcher_name = await page.$eval(
        `#${side}-team-last-5 a.anchor-with-border`,
        el => el.innerText.trim()
      )

      // find the row whose first <b> startsWith "Last 5 Avg"
      const vals = await page.$$eval(
        `#${side}-team-last-5 table tr`,
        trs => {
          const target = trs.find(tr => {
            const b = tr.querySelector('td b')
            return b && b.innerText.trim().startsWith('Last 5 Avg')
          })
          if (!target) {
            console.debug('Row HTML:', target?.outerHTML || 'none')
            return []
          }
          // grab all <b> except the first one
          return Array.from(target.querySelectorAll('td b'))
            .map(b=>b.innerText.trim())
            .slice(1)
        }
      )

      if (vals.length !== 10) {
        console.warn(`⚠️ ${role} stats missing for matchup ${matchup_id}`)
        if (DEBUG) console.debug(`Extracted vals for ${role}:`, vals)
        return
      }

      // destructure & parse floats
      const [ rawIp,rawH,rawR,rawEr,rawSo,rawBb,rawHr,rawPit,rawPip,rawGbfb ] = vals
      rows.push({
        matchup_id,
        pitcher_role: role,
        team_name:    label,
        team_id,
        pitcher_name,
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

    await scrapeSide('away')
    await scrapeSide('home')
  }

  await browser.close()
  console.log(`→ Scraped ${rows.length} pitching records`)
  if (DEBUG) console.debug(rows)
  return rows
}

export async function scrapeAndSavePitchingMatchups() {
  console.log('⏳ Starting pitching‑matchups scraper…')
  if (!(await testConnection())) {
    console.error('❌ Supabase connection failed')
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

    // compute ERA, ERA+, WHIP
    const enriched = stats.map(r => {
      const ip = r.ip  || 0
      const h  = r.h   || 0
      const er = r.er  || 0
      const bb = r.bb  || 0
      const era = ip>0 ? parseFloat(((er/ip)*9).toFixed(2)) : null
      const era_plus = era ? parseFloat((100*(4.1/era)).toFixed(0)) : null
      const whip = ip>0 ? parseFloat(((bb+h)/ip).toFixed(3)) : null
      return { ...r, era, era_plus, whip }
    })

    console.log(`→ Upserting ${enriched.length} records into Supabase…`)
    const { data, error } = await supabase
      .from('pitching_matchups')
      .upsert(enriched, { onConflict: ['matchup_id','pitcher_role'] })
      .select()

    if (error) throw error
    console.log(`✅ Inserted ${data.length} pitching records`)
    createScrapeReport({
      success:   true,
      timestamp: new Date().toISOString(),
      stats:     { records: data.length },
      records:   data
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

// auto‑run when this file is invoked directly
if (import.meta.url.endsWith('scrapePitchingMatchups.js')) {
  scrapeAndSavePitchingMatchups()
    .then(()=>process.exit(0))
    .catch(()=>process.exit(1))
}
