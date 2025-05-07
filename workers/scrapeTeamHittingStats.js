// workers/scrapeTeamHittingStats.js
//--------------------------------------------------------------
//  Scrape the MLB 7‑day team‑hitting table and persist results
//--------------------------------------------------------------
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { supabase, testConnection, createScrapeReport } from './lib/supabaseClient.js';
import { scrapeTodayMatchupIDs } from './scrapeMatchupIds.js';

const DEBUG = process.env.DEBUG === 'true';
const TIMEFRAME_DAYS = 7;

/**
 * Maps a raw team name to its proper name, abbreviation, and ID
 */
function mapTeamInfo(teamName) {
  const teamMap = {
    'Seattle Mariners':       { actual_team_name: 'Seattle Mariners', team_abbr: 'SEA', team_id: 1 },
    'Cleveland Guardians':    { actual_team_name: 'Cleveland Guardians', team_abbr: 'CLE', team_id: 2 },
    'Pittsburgh Pirates':     { actual_team_name: 'Pittsburgh Pirates', team_abbr: 'PIT', team_id: 3 },
    'Los Angeles Angels':     { actual_team_name: 'Los Angeles Angels', team_abbr: 'LAA', team_id: 4 },
    'Toronto Blue Jays':      { actual_team_name: 'Toronto Blue Jays', team_abbr: 'TOR', team_id: 5 },
    'Miami Marlins':          { actual_team_name: 'Miami Marlins', team_abbr: 'MIA', team_id: 6 },
    'Oakland Athletics':      { actual_team_name: 'Oakland Athletics', team_abbr: 'OAK', team_id: 7 },
    'New York Yankees':       { actual_team_name: 'New York Yankees', team_abbr: 'NYY', team_id: 8 },
    'Tampa Bay Rays':         { actual_team_name: 'Tampa Bay Rays', team_abbr: 'TBR', team_id: 9 },
    'Minnesota Twins':        { actual_team_name: 'Minnesota Twins', team_abbr: 'MIN', team_id: 10 },
    'Kansas City Royals':     { actual_team_name: 'Kansas City Royals', team_abbr: 'KCR', team_id: 11 },
    'San Francisco Giants':   { actual_team_name: 'San Francisco Giants', team_abbr: 'SFG', team_id: 12 },
    'Arizona Diamondbacks':   { actual_team_name: 'Arizona Diamondbacks', team_abbr: 'ARI', team_id: 13 },
    'Milwaukee Brewers':      { actual_team_name: 'Milwaukee Brewers', team_abbr: 'MIL', team_id: 14 },
    'Chicago White Sox':      { actual_team_name: 'Chicago White Sox', team_abbr: 'CWS', team_id: 15 },
    'Chicago Cubs':           { actual_team_name: 'Chicago Cubs', team_abbr: 'CHC', team_id: 16 },
    'Atlanta Braves':         { actual_team_name: 'Atlanta Braves', team_abbr: 'ATL', team_id: 17 },
    'San Diego Padres':       { actual_team_name: 'San Diego Padres', team_abbr: 'SDP', team_id: 18 },
    'Houston Astros':         { actual_team_name: 'Houston Astros', team_abbr: 'HOU', team_id: 19 },
    'New York Mets':          { actual_team_name: 'New York Mets', team_abbr: 'NYM', team_id: 20 },
    'Los Angeles Dodgers':    { actual_team_name: 'Los Angeles Dodgers', team_abbr: 'LAD', team_id: 21 },
    'Colorado Rockies':       { actual_team_name: 'Colorado Rockies', team_abbr: 'COL', team_id: 22 },
    'Cincinnati Reds':        { actual_team_name: 'Cincinnati Reds', team_abbr: 'CIN', team_id: 23 },
    'Washington Nationals':   { actual_team_name: 'Washington Nationals', team_abbr: 'WSH', team_id: 24 },
    'Detroit Tigers':         { actual_team_name: 'Detroit Tigers', team_abbr: 'DET', team_id: 25 },
    'Philadelphia Phillies':  { actual_team_name: 'Philadelphia Phillies', team_abbr: 'PHI', team_id: 26 },
    'St. Louis Cardinals':    { actual_team_name: 'St. Louis Cardinals', team_abbr: 'STL', team_id: 27 },
    'Texas Rangers':          { actual_team_name: 'Texas Rangers', team_abbr: 'TEX', team_id: 28 },
    'Boston Red Sox':         { actual_team_name: 'Boston Red Sox', team_abbr: 'BOS', team_id: 29 },
    'Baltimore Orioles':      { actual_team_name: 'Baltimore Orioles', team_abbr: 'BAL', team_id: 30 }
  };

  if (teamName.toUpperCase().includes('ATHLETICS') || teamName.includes('Oakland')) {
    return teamMap['Oakland Athletics'];
  }
  for (const [key, val] of Object.entries(teamMap)) {
    if (teamName.includes(key)) return val;
  }
  return { actual_team_name: null, team_abbr: null, team_id: null };
}

/**
 * Scrapes MLB team hitting statistics from the MLB stats website
 */
export async function scrapeTeamHittingStats() {
  const outPath = path.resolve(process.cwd(), 'scrape-result.json');
  let stats = [];

  try {
    const todayMatchupIDs = await scrapeTodayMatchupIDs();
    if (DEBUG) console.log('Today’s matchup IDs:', todayMatchupIDs);

    const url = `https://www.mlb.com/stats/team/hitting?sortState=asc&timeframe=-${TIMEFRAME_DAYS}`;
    console.log(`🕵️‍♂️ Launching Puppeteer → ${url}`);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36'
    );
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });

    const SEL_PRIMARY  = 'table[data-component="stats-table"] tbody tr';
    const SEL_FALLBACK = 'table.bui-table tbody tr';

    await page.waitForFunction(
      (a, b) => document.querySelector(a) || document.querySelector(b),
      { timeout: 45_000 },
      SEL_PRIMARY, SEL_FALLBACK
    );
    const TABLE_SEL = await page.evaluate(
      (a, b) => document.querySelector(a) ? a : b,
      SEL_PRIMARY, SEL_FALLBACK
    );
    await page.waitForTimeout(2_000);

    const rawRows = await page.evaluate(sel => {
      const out = [];
      for (const r of document.querySelectorAll(sel)) {
        const cells = [...r.querySelectorAll('th,td')];
        if (cells.length < 18) continue;
        const link = cells[0].querySelector('a');
        if (!link) continue;
        out.push({
          team_name:    link.textContent.trim(),
          league:       cells[1].textContent.trim(),
          games_played: +cells[2].textContent.trim() || 0,
          at_bats:      +cells[3].textContent.trim() || 0,
          runs:         +cells[4].textContent.trim() || 0,
          hits:         +cells[5].textContent.trim() || 0,
          doubles:      +cells[6].textContent.trim() || 0,
          triples:      +cells[7].textContent.trim() || 0,
          home_runs:    +cells[8].textContent.trim() || 0,
          rbi:          +cells[9].textContent.trim() || 0,
          bb:           +cells[10].textContent.trim() || 0,
          so:           +cells[11].textContent.trim() || 0,
          sb:           +cells[12].textContent.trim() || 0,
          cs:           +cells[13].textContent.trim() || 0,
          avg:          parseFloat(cells[14].textContent.trim()) || 0,
          obp:          parseFloat(cells[15].textContent.trim()) || 0,
          slg:          parseFloat(cells[16].textContent.trim()) || 0,
          ops:          parseFloat(cells[17].textContent.trim()) || 0
        });
      }
      return out;
    }, TABLE_SEL);

    console.log(`→ Extracted ${rawRows.length} rows (expected ~30)`);

    const gameDateISO = new Date().toISOString().slice(0,10);
    stats = rawRows.map(r => {
      const m = mapTeamInfo(r.team_name);
      return {
        ...r,
        timeframe_days:    TIMEFRAME_DAYS,
        game_date:         gameDateISO,
        actual_team_name:  m.actual_team_name,
        team_abbr:         m.team_abbr,
        team_id:           m.team_id
      };
    });

    if (DEBUG && stats.length) {
      console.log('Sample after mapping:', JSON.stringify(stats[0], null,2));
    }

    await browser.close();
    return stats;

  } catch (err) {
    console.error('[scrapeTeamHittingStats] fatal:', err);
    return [];

  } finally {
    const safe = stats.length
      ? stats
      : [{ success: false, error: 'scrape failed', timestamp: new Date().toISOString() }];
    fs.writeFileSync(outPath, JSON.stringify(safe, null,2));
    console.log(`📝 scrape-result.json written (${safe.length} rows)`);
  }
}

/**
 * Run any SQL migrations/cleanup on mlb_team_hitting_stats
 */
async function runTeamStatsMigration() {
  try {
    console.log('Running SQL migration and cleanup on mlb_team_hitting_stats table');
    const migrationSQL = `
    BEGIN;
    ALTER TABLE mlb_team_hitting_stats
      ADD COLUMN IF NOT EXISTS actual_team_name TEXT,
      ADD COLUMN IF NOT EXISTS team_abbr CHAR(3),
      ADD COLUMN IF NOT EXISTS team_id INTEGER;
    UPDATE mlb_team_hitting_stats
      SET actual_team_name = CASE
        WHEN team_name ILIKE '%Seattle Mariners%'       THEN 'Seattle Mariners'
        WHEN team_name ILIKE '%Cleveland Guardians%'    THEN 'Cleveland Guardians'
        WHEN team_name ILIKE '%Pittsburgh Pirates%'     THEN 'Pittsburgh Pirates'
        WHEN team_name ILIKE '%Los Angeles Angels%'     THEN 'Los Angeles Angels'
        WHEN team_name ILIKE '%Toronto Blue Jays%'      THEN 'Toronto Blue Jays'
        WHEN team_name ILIKE '%Miami Marlins%'          THEN 'Miami Marlins'
        WHEN team_name ILIKE '%Oakland Athletics%'      THEN 'Oakland Athletics'
        WHEN team_name ILIKE '%Athletics%'              THEN 'Oakland Athletics'
        WHEN team_name ILIKE '%New York Yankees%'       THEN 'New York Yankees'
        WHEN team_name ILIKE '%Tampa Bay Rays%'         THEN 'Tampa Bay Rays'
        WHEN team_name ILIKE '%Minnesota Twins%'        THEN 'Minnesota Twins'
        WHEN team_name ILIKE '%Kansas City Royals%'     THEN 'Kansas City Royals'
        WHEN team_name ILIKE '%San Francisco Giants%'   THEN 'San Francisco Giants'
        WHEN team_name ILIKE '%Arizona Diamondbacks%'   THEN 'Arizona Diamondbacks'
        WHEN team_name ILIKE '%Milwaukee Brewers%'      THEN 'Milwaukee Brewers'
        WHEN team_name ILIKE '%Chicago White Sox%'      THEN 'Chicago White Sox'
        WHEN team_name ILIKE '%Chicago Cubs%'           THEN 'Chicago Cubs'
        WHEN team_name ILIKE '%Atlanta Braves%'         THEN 'Atlanta Braves'
        WHEN team_name ILIKE '%San Diego Padres%'       THEN 'San Diego Padres'
        WHEN team_name ILIKE '%Houston Astros%'         THEN 'Houston Astros'
        WHEN team_name ILIKE '%New York Mets%'          THEN 'New York Mets'
        WHEN team_name ILIKE '%Los Angeles Dodgers%'    THEN 'Los Angeles Dodgers'
        WHEN team_name ILIKE '%Colorado Rockies%'       THEN 'Colorado Rockies'
        WHEN team_name ILIKE '%Cincinnati Reds%'        THEN 'Cincinnati Reds'
        WHEN team_name ILIKE '%Washington Nationals%'   THEN 'Washington Nationals'
        WHEN team_name ILIKE '%Detroit Tigers%'         THEN 'Detroit Tigers'
        WHEN team_name ILIKE '%Philadelphia Phillies%'  THEN 'Philadelphia Phillies'
        WHEN team_name ILIKE '%St. Louis Cardinals%'    THEN 'St. Louis Cardinals'
        WHEN team_name ILIKE '%Texas Rangers%'          THEN 'Texas Rangers'
        WHEN team_name ILIKE '%Boston Red Sox%'         THEN 'Boston Red Sox'
        WHEN team_name ILIKE '%Baltimore Orioles%'      THEN 'Baltimore Orioles'
        ELSE actual_team_name END,
      team_abbr = CASE
        WHEN team_name ILIKE '%Seattle Mariners%'       THEN 'SEA'
        WHEN team_name ILIKE '%Cleveland Guardians%'    THEN 'CLE'
        WHEN team_name ILIKE '%Pittsburgh Pirates%'     THEN 'PIT'
        WHEN team_name ILIKE '%Los Angeles Angels%'     THEN 'LAA'
        WHEN team_name ILIKE '%Toronto Blue Jays%'      THEN 'TOR'
        WHEN team_name ILIKE '%Miami Marlins%'          THEN 'MIA'
        WHEN team_name ILIKE '%Oakland Athletics%'      THEN 'OAK'
        WHEN team_name ILIKE '%Athletics%'              THEN 'OAK'
        WHEN team_name ILIKE '%New York Yankees%'       THEN 'NYY'
        WHEN team_name ILIKE '%Tampa Bay Rays%'         THEN 'TBR'
        WHEN team_name ILIKE '%Minnesota Twins%'        THEN 'MIN'
        WHEN team_name ILIKE '%Kansas City Royals%'     THEN 'KCR'
        WHEN team_name ILIKE '%San Francisco Giants%'   THEN 'SFG'
        WHEN team_name ILIKE '%Arizona Diamondbacks%'   THEN 'ARI'
        WHEN team_name ILIKE '%Milwaukee Brewers%'      THEN 'MIL'
        WHEN team_name ILIKE '%Chicago White Sox%'      THEN 'CWS'
        WHEN team_name ILIKE '%Chicago Cubs%'           THEN 'CHC'
        WHEN team_name ILIKE '%Atlanta Braves%'         THEN 'ATL'
        WHEN team_name ILIKE '%San Diego Padres%'       THEN 'SDP'
        WHEN team_name ILIKE '%Houston Astros%'         THEN 'HOU'
        WHEN team_name ILIKE '%New York Mets%'          THEN 'NYM'
        WHEN team_name ILIKE '%Los Angeles Dodgers%'    THEN 'LAD'
        WHEN team_name ILIKE '%Colorado Rockies%'       THEN 'COL'
        WHEN team_name ILIKE '%Cincinnati Reds%'        THEN 'CIN'
        WHEN team_name ILIKE '%Washington Nationals%'   THEN 'WSH'
        WHEN team_name ILIKE '%Detroit Tigers%'         THEN 'DET'
        WHEN team_name ILIKE '%Philadelphia Phillies%'  THEN 'PHI'
        WHEN team_name ILIKE '%St. Louis Cardinals%'    THEN 'STL'
        WHEN team_name ILIKE '%Texas Rangers%'          THEN 'TEX'
        WHEN team_name ILIKE '%Boston Red Sox%'         THEN 'BOS'
        WHEN team_name ILIKE '%Baltimore Orioles%'      THEN 'BAL'
        ELSE team_abbr END,
      team_id = CASE
        WHEN team_name ILIKE '%Seattle Mariners%'       THEN 1
        WHEN team_name ILIKE '%Cleveland Guardians%'    THEN 2
        WHEN team_name ILIKE '%Pittsburgh Pirates%'     THEN 3
        WHEN team_name ILIKE '%Los Angeles Angels%'     THEN 4
        WHEN team_name ILIKE '%Toronto Blue Jays%'      THEN 5
        WHEN team_name ILIKE '%Miami Marlins%'          THEN 6
        WHEN team_name ILIKE '%Oakland Athletics%'      THEN 7
        WHEN team_name ILIKE '%Athletics%'              THEN 7
        WHEN team_name ILIKE '%New York Yankees%'       THEN 8
        WHEN team_name ILIKE '%Tampa Bay Rays%'         THEN 9
        WHEN team_name ILIKE '%Minnesota Twins%'        THEN 10
        WHEN team_name ILIKE '%Kansas City Royals%'     THEN 11
        WHEN team_name ILIKE '%San Francisco Giants%'   THEN 12
        WHEN team_name ILIKE '%Arizona Diamondbacks%'   THEN 13
        WHEN team_name ILIKE '%Milwaukee Brewers%'      THEN 14
        WHEN team_name ILIKE '%Chicago White Sox%'      THEN 15
        WHEN team_name ILIKE '%Chicago Cubs%'           THEN 16
        WHEN team_name ILIKE '%Atlanta Braves%'         THEN 17
        WHEN team_name ILIKE '%San Diego Padres%'       THEN 18
        WHEN team_name ILIKE '%Houston Astros%'         THEN 19
        WHEN team_name ILIKE '%New York Mets%'          THEN 20
        WHEN team_name ILIKE '%Los Angeles Dodgers%'    THEN 21
        WHEN team_name ILIKE '%Colorado Rockies%'       THEN 22
        WHEN team_name ILIKE '%Cincinnati Reds%'        THEN 23
        WHEN team_name ILIKE '%Washington Nationals%'   THEN 24
        WHEN team_name ILIKE '%Detroit Tigers%'         THEN 25
        WHEN team_name ILIKE '%Philadelphia Phillies%'  THEN 26
        WHEN team_name ILIKE '%St. Louis Cardinals%'    THEN 27
        WHEN team_name ILIKE '%Texas Rangers%'          THEN 28
        WHEN team_name ILIKE '%Boston Red Sox%'         THEN 29
        WHEN team_name ILIKE '%Baltimore Orioles%'      THEN 30
        ELSE team_id END
    WHERE actual_team_name IS NULL OR team_abbr IS NULL OR team_id IS NULL;
    COMMIT;`;

    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    if (error) {
      console.error('Error running SQL migration:', error);
      return false;
    }
    console.log('✅ Successfully ran SQL migration and cleanup');
    return true;

  } catch (err) {
    console.error('Error running SQL migration:', err);
    return false;
  }
}

/**
 * Saves team hitting stats to Supabase
 */
async function saveTeamStatsToSupabase(teamStats) {
  if (!teamStats || teamStats.length === 0) {
    console.log('No team stats to save');
    return false;
  }

  console.log(`Saving ${teamStats.length} team hitting stats to Supabase`);
  if (!(await testConnection())) {
    console.error('❌ Supabase connection failed, aborting.');
    return false;
  }

  const enhanced = teamStats.map(stat => {
    const m = mapTeamInfo(stat.team_name);
    return {
      ...stat,
      team_id:          m.team_id,
      team_abbr:       m.team_abbr || stat.team_abbr,
      actual_team_name:m.actual_team_name || stat.actual_team_name
    };
  });

  const timeframe = enhanced[0].timeframe_days;
  const gameDate  = enhanced[0].game_date;

  // delete existing
  const { error: delErr } = await supabase
    .from('mlb_team_hitting_stats')
    .delete()
    .eq('timeframe_days', timeframe)
    .eq('game_date', gameDate);
  if (delErr) {
    console.error('Error deleting existing team stats:', delErr);
    return false;
  }
  console.log('✅ Deleted existing records');

  // insert new
  const { data, error: insertErr } = await supabase
    .from('mlb_team_hitting_stats')
    .insert(enhanced);
  if (insertErr) {
    console.error('Error inserting team stats:', insertErr);
    createScrapeReport({
      success: false,
      error: insertErr.message,
      timestamp: new Date().toISOString(),
      stats: { seven_day: enhanced.length }
    });
    return false;
  }
  console.log(`✅ Inserted ${data.length} records`);

  // run migration/cleanup
  await runTeamStatsMigration();
  return true;
}

/**
 * Main entrypoint: scrape & save
 */
export async function updateTeamHittingStats() {
  console.log('⏳ Starting MLB team hitting stats update...');
  const results = { success: false, stats: { seven_day: 0 }, timestamp: new Date().toISOString() };

  try {
    if (!(await testConnection())) {
      throw new Error('Supabase connection failed');
    }
    const stats = await scrapeTeamHittingStats();
    results.stats.seven_day = stats.length;
    results.success = stats.length > 0 && await saveTeamStatsToSupabase(stats);
  } catch (err) {
    console.error('updateTeamHittingStats error:', err);
    results.success = false;
    results.error = err.message;
  } finally {
    createScrapeReport(results);
  }

  return results;
}

// if run directly…
if (import.meta.url.endsWith('scrapeTeamHittingStats.js')) {
  updateTeamHittingStats()
    .then(r => process.exit(r.success ? 0 : 1))
    .catch(() => process.exit(1));
}
