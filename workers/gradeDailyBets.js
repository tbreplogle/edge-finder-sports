// workers/scrapeDailyResults.js
/* Grade yesterday’s locked bets and write P/L rows
   -------------------------------------------------*/
   import puppeteer from 'puppeteer';
   import { supabase, testConnection } from './lib/supabaseClient.js';
   
   /* helpers ----------------------------------------------------*/
   function getYesterdayDateCT() {
     const now = new Date(
       new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
     );
     now.setDate(now.getDate() - 1);
     return now.toISOString().slice(0, 10);           // YYYY-MM-DD
   }
   function oddsToProfit(ml, stake = 100) {
     return ml > 0 ? (ml / 100) * stake
                   : (100 / Math.abs(ml)) * stake;
   }
   
   /* scrape Covers final scores --------------------------------*/
   async function scrapeScores(date) {
     const url = `https://www.covers.com/sports/mlb/matchups?selectedDate=${date}`;
     const browser = await puppeteer.launch({
       headless: 'new',
       args: ['--no-sandbox','--disable-setuid-sandbox']
     });
     const page = await browser.newPage();
     await page.setViewport({ width: 1920, height: 1080 });
     await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
   
     const rows = await page.$$eval('article.gamebox', boxes =>
       boxes.map(box => {
         const href = box.querySelector('a.matchup-btn-link')?.href ?? '';
         const m    = href.match(/\/matchup\/(\d+)$/);
         if (!m) return null;
         const [away, home] = Array.from(
           box.querySelectorAll('.team-score')
         ).map(el => parseInt(el.textContent.trim(), 10));
         if (away == null || home == null) return null;
         return { matchup_id: m[1], away_score: away, home_score: home };
       }).filter(Boolean)
     );
     await browser.close();
     return Object.fromEntries(rows.map(r => [r.matchup_id, r]));
   }
   
   /* main -------------------------------------------------------*/
   async function gradeBets() {
     if (!(await testConnection())) throw new Error('DB connection failed');
   
     const yDate = getYesterdayDateCT();
   
     /* 1) yesterday’s locked bets */
     const { data: bets, error: betErr } = await supabase
       .from('mlb_daily_bets')
       .select('*')
       .eq('game_date', yDate);
   
     if (betErr) throw betErr;
     if (!bets.length) {
       console.log(`No locked bets to grade for ${yDate}`);
       return;
     }
   
     /* 2) matchup meta to know which team is home/away */
     const { data: metas, error: metaErr } = await supabase
       .from('mlb_matchups')
       .select('matchup_id, home_team_id, away_team_id')
       .eq('game_date', yDate);
     if (metaErr) throw metaErr;
     const metaById = Object.fromEntries(metas.map(m => [m.matchup_id, m]));
   
     /* 3) scrape final scores */
     const scoreById = await scrapeScores(yDate);
   
     /* 4) build result rows */
     const rows = bets
       .map(b => {
         const meta  = metaById[b.matchup_id];
         const score = scoreById[b.matchup_id];
         if (!meta || !score) return null;
   
         const win =
           (b.chosen_team_id === meta.home_team_id && score.home_score > score.away_score) ||
           (b.chosen_team_id === meta.away_team_id && score.away_score > score.home_score);
   
         const profit   = win ? +oddsToProfit(b.moneyline, b.stake).toFixed(2) : -b.stake;
         const roi_pct  = +(profit / b.stake * 100).toFixed(2);
   
         return {
           matchup_id     : b.matchup_id,
           game_date      : yDate,
           chosen_team_id : b.chosen_team_id,
           confidence     : b.confidence,
           moneyline      : b.moneyline,
           stake          : b.stake,
           profit,
           roi_pct,
           outcome        : win ? 'win' : 'loss'
         };
       })
       .filter(Boolean);
   
     if (!rows.length) {
       console.warn('No complete rows to insert – abort.');
       return;
     }
   
     /* 5) insert */
     const { error: insErr } = await supabase
       .from('mlb_daily_results')
       .insert(rows);
     if (insErr) throw insErr;
   
     console.log(`✅ Graded ${rows.length} bets for ${yDate}`);
   }
   
   if (import.meta.url.endsWith('scrapeDailyResults.js')) {
     gradeBets().then(() => process.exit(0)).catch(err => {
       console.error(err); process.exit(1);
     });
   }
   