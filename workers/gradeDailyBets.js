/*  Grade ALL un-graded MLB bets (≤ today)       2025-06-18
   --------------------------------------------------------
   • Reads mlb_daily_bets where game_date < today
   • Scrapes final scores from Covers.com
   • Upserts P/L rows into mlb_daily_results
*/
import puppeteer from 'puppeteer';
import { supabase, testConnection } from './lib/supabaseClient.js';

/* ---------- helpers --------------------------------------------------- */
const CT_TZ = 'America/Chicago';
const today = () => new Date(new Date().toLocaleString('en-US',{timeZone:CT_TZ}))
                      .toISOString().slice(0,10);

/* scraping utils (same selectors as latest Covers layout) -------------- */
const launch = () => puppeteer.launch({
  channel :'chrome',
  headless:'new',
  args    : ['--no-sandbox']
});

async function listPageScores(date) {
  const url = `https://www.covers.com/sports/mlb/matchups?selectedDate=${date}`;
  const browser = await launch();
  const page    = await browser.newPage();
  await page.goto(url,{waitUntil:'networkidle2',timeout:60_000});

  const scores = await page.$$eval('article', arts => {
    const m={};
    arts.forEach(a=>{
      const id  = a.querySelector('a.matchup-btn-link')?.href.match(/(\d+)$/)?.[1];
      const pts = [...a.querySelectorAll('.covers-CoversMatchups-LiveScore')]
                    .map(el=>parseInt(el.textContent.trim(),10));
      if(id&&pts.length===2) m[id]={away:pts[0],home:pts[1]};
    });
    return m;
  });
  await browser.close();
  return scores;                                 // { id:{away,home} }
}

async function boxScore(browser,id){
  const url=`https://www.covers.com/sport/baseball/mlb/boxscore/${id}`;
  const page=await browser.newPage();
  try{
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:45_000});
    const pts=await page.$$eval('.covers-CoversMatchups-LiveScore',
               els=>els.slice(0,2).map(e=>parseInt(e.textContent.trim(),10)));
    return pts.length===2?{away:pts[0],home:pts[1]}:null;
  }catch{ return null; }
  finally{ await page.close(); }
}

/* ---------- main grading routine ------------------------------------- */
async function gradeForDate(gDate,bets) {
  /* fetch meta */
  const {data:metas,error:metaErr}=await supabase
        .from('mlb_matchups')
        .select('matchup_id,home_team_id,away_team_id')
        .eq('game_date',gDate);
  if(metaErr) throw metaErr;
  const metaBy=Object.fromEntries(metas.map(m=>[m.matchup_id,m]));

  /* scrape scores */
  const ids=[...new Set(bets.map(b=>b.matchup_id))];
  const scoreMap=await listPageScores(gDate);
  const missing=ids.filter(id=>!scoreMap[id]);
  if(missing.length){
    const browser=await launch();
    for(const id of missing){
      const s=await boxScore(browser,id);
      if(s) scoreMap[id]=s;
    }
    await browser.close();
  }

  /* build rows */
  const rows=bets.map(b=>{
    const m=metaBy[b.matchup_id], s=scoreMap[b.matchup_id];
    if(!m||!s) return null;
    const chosenHome=b.team_id===m.home_team_id;
    const win=chosenHome ? s.home>s.away : s.away>s.home;
    return {
      matchup_id :b.matchup_id,
      game_date  :gDate,
      team_id    :b.team_id,
      team_name  :b.team_name,
      confidence :b.confidence,
      moneyline  :b.moneyline,
      stake      :b.stake,
      to_win     :b.to_win,
      profit_loss:win?b.to_win:-b.stake,
      outcome    :win?'win':'loss'
    };
  }).filter(Boolean);

  if(!rows.length){
    console.log(`⚠️  ${gDate}: no complete rows (meta or scores missing)`);
    return;
  }

  const {error:insErr}=await supabase
      .from('mlb_daily_results')
      .upsert(rows,{onConflict:'matchup_id,team_id'});
  if(insErr) throw insErr;
  console.log(`✅ ${gDate}: graded ${rows.length} bets`);
}

async function gradeAllPastBets(){
  if(!(await testConnection())) throw new Error('DB connection failed');
  const todayStr=today();

  /* pull every bet whose game_date < today */
  const {data:bets,error}=await supabase
        .from('mlb_daily_bets')
        .select('*')
        .lt('game_date',todayStr);
  if(error) throw error;
  if(!bets.length) return console.log('No past bets to grade.');

  /* group by game_date */
  const byDate=bets.reduce((m,b)=>(m[b.game_date]=(m[b.game_date]||[]).concat(b),m),{});
  for(const gDate of Object.keys(byDate).sort()){
    try{ await gradeForDate(gDate,byDate[gDate]); }
    catch(err){ console.error(`❌ ${gDate}:`,err.message); }
  }
}

/* CLI */
if(import.meta.url.endsWith('gradeDailyBets.js')){
  gradeAllPastBets()
    .then(()=>process.exit(0))
    .catch(e=>{console.error(e);process.exit(1);});
}
