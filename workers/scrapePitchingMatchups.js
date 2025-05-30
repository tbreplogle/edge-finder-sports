/* workers/scrapePitchingMatchups.js
   Scrape Covers pitcher “last-5 avg” stats and upsert to Supabase  */

   import puppeteer from 'puppeteer';
   import {
     supabase,
     testConnection,
     createScrapeReport
   } from './lib/supabaseClient.js';
   
   const DEBUG = process.env.DEBUG === 'true';
   
   /* Covers tab text → teams_mlb.team_id ------------------------ */
   const TEAM_ALT_NAME_TO_ID = {
     SEATTLE: 1, CLEVELAND: 2, PITTSBURGH: 3, 'LA ANGELS': 4, TORONTO: 5,
     MIAMI: 6, ATHLETICS: 7, 'NY YANKEES': 8, 'TAMPA BAY': 9, MINNESOTA: 10,
     'KANSAS CITY': 11, 'SF GIANTS': 12, 'SAN FRANCISCO': 12, ARIZONA: 13,
     MILWAUKEE: 14, 'CHI. WHITE SOX': 15, 'CHI. CUBS': 16, ATLANTA: 17,
     'SAN DIEGO': 18, HOUSTON: 19, 'NY METS': 20, 'LA DODGERS': 21,
     COLORADO: 22, CINCINNATI: 23, WASHINGTON: 24, DETROIT: 25,
     PHILADELPHIA: 26, 'ST. LOUIS': 27, TEXAS: 28, BOSTON: 29, BALTIMORE: 30
   };
   
   /* ─────────────────────────────────────────────────────────────
      1)  Load today’s games (unique by game_id)
      ────────────────────────────────────────────────────────────*/
   async function loadTodayGames () {
     const today = new Date().toISOString().slice(0, 10);
   
     const { data, error } = await supabase
       .from('mlb_matchups')
       .select('matchup_id, game_id')
       .eq('game_date', today);
   
     if (error) throw new Error(error.message || 'Supabase error');
     if (!data?.length) return [];
   
     /* Deduplicate by game_id (stringified key) */
     return Array.from(new Map(
       data.map(g => [String(g.game_id), g])
     ).values());
   }
   
   /* ─────────────────────────────────────────────────────────────
      2)  Scrape a single Covers matchup page
      ────────────────────────────────────────────────────────────*/
   async function scrapeMatchupPage (page, { matchup_id, game_id }) {
     const url = `https://www.covers.com/sport/baseball/mlb/matchup/${matchup_id}`;
     console.log(`→ Loading ${url}`);
     await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
     await page.waitForSelector('a[href="#away-team-last-5"]', { timeout: 30_000 });
   
     const rows = [];
   
     for (const role of ['away', 'home']) {
       const tabId = role === 'away' ? '#away-team-last-5' : '#home-team-last-5';
   
       /* team name / id */
       let team_name = null;
       let team_id   = null;
       try {
         team_name = await page.$eval(
           `a[href="${tabId}"]`,
           el => el.innerText.trim().toUpperCase()
         );
         team_id = TEAM_ALT_NAME_TO_ID[team_name] ?? null;
       } catch {/* no team header, skip */ }
   
       /* pitcher name (required) */
       let pitcher_name;
       try {
         pitcher_name = await page.$eval(
           `${tabId} a.anchor-with-border`,
           el => el.innerText.trim()
         );
       } catch { continue; }
   
       /* find the “last-X avg” row */
       const rowHandle = await page.$$eval(
         `${tabId} table tr`,
         trs => {
           for (const tr of trs) {
             const b = tr.querySelector('td b');
             if (!b) continue;
             const t = b.textContent.trim().toLowerCase();
             if (t.includes('last') && t.includes('avg')) return tr.innerHTML;
           }
           return null;
         }
       );
   
       if (!rowHandle) continue;
   
       /* extract the ten numeric cells in that row */
       const nums = await page.evaluate(html => {
         const div = document.createElement('table');
         div.innerHTML = html;
         return Array.from(div.querySelectorAll('td b'))
           .slice(1)          // skip label cell
           .map(b => parseFloat(b.textContent.trim()) || 0);
       }, rowHandle);
   
       if (nums.length < 10) continue;   // unexpected layout
   
       const [ip, h, r, er, so, bb, hr, pit, pip, gbfb] = nums;
   
       const era      = ip ? +((er / ip) * 9).toFixed(2) : null;
       const era_plus = era ? Math.round((100 * 4.1) / era) : null;
       const whip     = ip ? +(((bb + h) / ip).toFixed(3)) : null;
   
       rows.push({
         game_id,
         matchup_id,
         pitcher_role: role,
         team_name,
         team_id,
         pitcher_name,
         ip,
         h,
         r,
         er,
         so,
         bb,
         hr,
         pit,
         pip,
         gbfb,
         era,
         era_plus,
         whip
       });
     }
   
     return rows;
   }
   
   /* ─────────────────────────────────────────────────────────────
      3)  Master routine
      ────────────────────────────────────────────────────────────*/
   export async function scrapeAndSavePitchingMatchups () {
     console.log('⏳ Starting pitching-matchups scraper…');
   
     if (!(await testConnection())) {
       console.error('❌ Supabase connection failed, aborting.');
       process.exit(1);
     }
   
     try {
       const games = await loadTodayGames();
       console.log(`→ Found ${games.length} rows but ${games.length} unique game_ids`);
       if (!games.length) throw new Error('No games for today');
   
       const browser = await puppeteer.launch({
         headless: 'new',
         channel:  'chrome',
         args: ['--no-sandbox', '--disable-setuid-sandbox']
       });
       const page = await browser.newPage();
       await page.setViewport({ width: 1920, height: 1080 });
   
       const seenMatchups = new Set();
       let rows = [];
   
       for (const g of games) {
         if (seenMatchups.has(g.matchup_id)) continue; // safety
         seenMatchups.add(g.matchup_id);
         rows = rows.concat(await scrapeMatchupPage(page, g));
       }
   
       await browser.close();
       console.log(`→ Scraped ${rows.length} pitcher records`);
   
       /* FINAL de-duplication right before insert */
       const uniqueRows = Array.from(new Map(
         rows.map(r => [`${r.matchup_id}-${r.pitcher_role}`, r])
       ).values());
   
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
       console.error('❌ Error:', err.message);
       await createScrapeReport({
         success: false,
         error: err.message,
         timestamp: new Date().toISOString(),
         stats: { records: 0 }
       });
     }
   }
   
   /* ─────────────────────────────────────────────────────────────
      CLI entry
      ────────────────────────────────────────────────────────────*/
   if (import.meta.url.endsWith('scrapePitchingMatchups.js')) {
     scrapeAndSavePitchingMatchups()
       .then(() => process.exit(0))
       .catch(() => process.exit(1));
   }
   