/* workers/scrapePitchingMatchups.js
   Scrape Covers pitcher “last-5 avg” lines and upsert to Supabase */

   import puppeteer from 'puppeteer';
   import {
     supabase,
     testConnection,
     createScrapeReport
   } from './lib/supabaseClient.js';
   
   const DEBUG = process.env.DEBUG === 'true';
   
   /* Covers tab text → teams_mlb.team_id */
   const TEAM_ALT_NAME_TO_ID = {
     SEATTLE: 1, CLEVELAND: 2, PITTSBURGH: 3, 'LA ANGELS': 4, TORONTO: 5,
     MIAMI: 6, ATHLETICS: 7, 'NY YANKEES': 8, 'TAMPA BAY': 9, MINNESOTA: 10,
     'KANSAS CITY': 11, 'SF GIANTS': 12, 'SAN FRANCISCO': 12, ARIZONA: 13,
     MILWAUKEE: 14, 'CHI. WHITE SOX': 15, 'CHI. CUBS': 16, ATLANTA: 17,
     'SAN DIEGO': 18, HOUSTON: 19, 'NY METS': 20, 'LA DODGERS': 21,
     COLORADO: 22, CINCINNATI: 23, WASHINGTON: 24, DETROIT: 25,
     PHILADELPHIA: 26, 'ST. LOUIS': 27, TEXAS: 28, BOSTON: 29, BALTIMORE: 30
   };
   
   /*───────────────────────────────────────────────────────────────
     1) Pull today’s matchups (unique by game_id)
   ───────────────────────────────────────────────────────────────*/
   async function loadTodayGames () {
     const today = new Date().toISOString().slice(0, 10);
     const { data, error } = await supabase
       .from('mlb_matchups')
       .select('matchup_id, game_id')
       .eq('game_date', today);
   
     if (error) throw new Error(`Could not load games: ${error.message}`);
     if (!data || !data.length) return [];
   
     /* de-dup by game_id */
     return Array.from(new Map(data.map(g => [String(g.game_id), g])).values());
   }
   
   /*───────────────────────────────────────────────────────────────
     2) Scrape one Covers matchup page
   ───────────────────────────────────────────────────────────────*/
   async function scrapeOneMatchup (page, { matchup_id, game_id }) {
     const url = `https://www.covers.com/sport/baseball/mlb/matchup/${matchup_id}`;
     await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
     await page.waitForSelector('a[href="#away-team-last-5"]', { timeout: 30_000 });
   
     const rows = [];
   
     for (const role of ['away', 'home']) {
       const tab = role === 'away' ? '#away-team-last-5' : '#home-team-last-5';
   
       /* team name/id */
       let team_name = null;
       let team_id   = null;
       try {
         team_name = await page.$eval(
           `a[href="${tab}"]`,
           el => el.innerText.trim().toUpperCase()
         );
         team_id = TEAM_ALT_NAME_TO_ID[team_name] ?? null;
       } catch {/* ignore */}
   
       /* pitcher name */
       let pitcher_name = null;
       try {
         pitcher_name = await page.$eval(
           `${tab} a.anchor-with-border`,
           el => el.innerText.trim()
         );
       } catch { continue; }
   
       /* locate “last-X avg” row */
       const trHandles = await page.$$(`${tab} table tr`);
       let statRow = null;
       for (const tr of trHandles) {
         try {
           const t = await tr.$eval('td b', b => b.innerText.trim().toLowerCase());
           if (t.includes('last') && t.includes('avg')) { statRow = tr; break; }
         } catch {/* ignore */}
       }
       if (!statRow) continue;
   
       const nums = await statRow.$$eval('td b', bs =>
         bs.slice(1).map(b => b.innerText.trim())
       );
       if (nums.length < 10) continue;
   
       const [ip, h, r, er, so, bb, hr, pit, pip, gbfb] =
         nums.map(n => parseFloat(n) || 0);
   
       const era      = ip ? +((er / ip) * 9).toFixed(2) : null;
       const era_plus = era ? Math.round((100 * 4.1) / era) : null;
       const whip     = ip ? +(((bb + h) / ip).toFixed(3)) : null;
   
       rows.push({
         game_id, matchup_id, pitcher_role: role,
         team_name, team_id, pitcher_name,
         ip, h, r, er, so, bb, hr, pit, pip, gbfb, era, era_plus, whip
       });
     }
   
     return rows;
   }
   
   /*───────────────────────────────────────────────────────────────
     3) Master routine
   ───────────────────────────────────────────────────────────────*/
   export async function scrapeAndSavePitchingMatchups () {
     console.log('⏳ Starting pitching-matchups scraper…');
     if (!(await testConnection())) {
       console.error('❌ Supabase connection failed, aborting.');
       process.exit(1);
     }
   
     try {
       const games = await loadTodayGames();
       console.log(`→ Found ${games.length} rows but ${games.length} unique game_ids`);
       if (!games.length) throw new Error('No games today');
   
       const browser = await puppeteer.launch({
         headless: 'new',
         channel:  'chrome',
         args: ['--no-sandbox', '--disable-setuid-sandbox']
       });
       const page = await browser.newPage();
       await page.setViewport({ width: 1920, height: 1080 });
   
       const seen = new Set();            // ensure we never hit same URL twice
       let rows   = [];
   
       for (const g of games) {
         if (seen.has(g.matchup_id)) continue;
         seen.add(g.matchup_id);
         console.log(`→ Loading https://www.covers.com/sport/baseball/mlb/matchup/${g.matchup_id}`);
         rows = rows.concat(await scrapeOneMatchup(page, g));
       }
   
       await browser.close();
       console.log(`→ Scraped ${rows.length} pitcher records`);
   
       /* ---------- dedupe again before upsert ---------- */
       const uniqueRows = Array.from(
         new Map(
           rows.map(r => [`${r.matchup_id}-${r.pitcher_role}`, r])
         ).values()
       );
   
       console.log(`→ Upserting ${uniqueRows.length} rows to Supabase…`);
       const { data, error } = await supabase
         .from('pitching_matchups')
         .upsert(uniqueRows, { onConflict: 'matchup_id,pitcher_role' })
         .select();
   
       if (error) throw error;
   
       console.log(`✅ Saved ${data.length} pitching records`);
       await createScrapeReport({
         success: true,
         timestamp: new Date().toISOString(),
         stats: { records: data.length }
       });
     } catch (err) {
       console.error('❌ Error inserting pitching stats:', err.message);
       await createScrapeReport({
         success: false,
         error: err.message,
         timestamp: new Date().toISOString(),
         stats: { records: 0 }
       });
     }
   }
   
   /*───────────────────────────────────────────────────────────────
     CLI entry
   ───────────────────────────────────────────────────────────────*/
   if (import.meta.url.endsWith('scrapePitchingMatchups.js')) {
     scrapeAndSavePitchingMatchups()
       .then(() => process.exit(0))
       .catch(() => process.exit(1));
   }
   