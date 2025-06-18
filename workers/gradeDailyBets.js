/* gradeDailyBets.js  – 2025-06-18  (meta-less, dual-selector) */
import puppeteer from 'puppeteer';
import { supabase, testConnection } from './lib/supabaseClient.js';

/* 🗺️  team alias → 3-letter abbr  (extend if you use other labels) */
const NAME_TO_ABBR = {
  'CHI. WHITE SOX': 'CWS', 'CHICAGO WHITE SOX': 'CWS', 'WHITE SOX': 'CWS',
  'KANSAS CITY': 'KCR', 'KANSAS CITY ROYALS': 'KCR', 'ROYALS': 'KCR',
  'TAMPA BAY': 'TBR', 'TAMPA BAY RAYS': 'TBR', 'RAYS': 'TBR',
  'COLORADO': 'COL', 'COLORADO ROCKIES': 'COL',
  /* … add the rest once … */
};

const todayISO = () =>
  new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
            .split(',')[0];

/* ───────── scrape one box-score page ───────── */
async function scrapeBox(matchupId, browser) {
  const url = `https://www.covers.com/sport/baseball/mlb/boxscore/${matchupId}`;
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });

    /* newest layout we saw first */
    const head = await page.$('.covers-CoversMatchupDetails-leadIn');
    if (head) {
      const scores = await page.$$eval(
        '.covers-CoversMatchups-LiveScore',
        els => els.slice(0,2).map(el=>parseInt(el.textContent.trim(),10))
      );
      const abbrs = await page.$$eval(
        '.covers-CoversMatchupDetails-awayName, .covers-CoversMatchupDetails-homeName',
        els => els.map(el=>el.textContent.trim().toUpperCase())
      );
      if (scores.length===2 && abbrs.length===2)
        return { away_abbr: abbrs[0], home_abbr: abbrs[1], away:scores[0], home:scores[1] };
    }

    /* fallback older layout (uppercaseHelper / leagueAvgBg) */
    const abbrs = await page.$$eval(
      'a.covers-CoversMatchups-uppercaseHelper',
      els => els.map(e=>e.textContent.trim().toUpperCase()).slice(0,2)
    );
    const nums  = await page.$$eval(
      'td.covers-CoversMatchups-leagueAvgBg',
      els => els.map(e=>parseInt(e.textContent.trim(),10)).slice(-2)
    );
    return abbrs.length===2 && nums.length===2
      ? { away_abbr: abbrs[0], home_abbr: abbrs[1], away: nums[0], home: nums[1] }
      : null;

  } catch { return null; }
  finally { await page.close(); }
}

/* ───────── grade every past-dated bet ───────── */
async function gradeAll() {
  if (!(await testConnection())) throw new Error('DB connection failed');

  const { data:bets } = await supabase
        .from('mlb_daily_bets')
        .select('*')
        .lt('game_date', todayISO());

  if (!bets?.length) return console.log('Nothing to grade.');

  /* group by date */
  const byDate = bets.reduce((m,b)=>(m[b.game_date]=(m[b.game_date]||[]).push(b),m),{});

  for (const gDate of Object.keys(byDate).sort()) {
    const dateBets = byDate[gDate];
    const browser  = await puppeteer.launch({ channel:'chrome', headless:'new', args:['--no-sandbox'] });

    const scoreMap = {};
    for (const id of new Set(dateBets.map(b=>b.matchup_id))) {
      const box = await scrapeBox(id,browser);
      if (box) scoreMap[id] = box;
    }
    await browser.close();

    const rows = dateBets.map(bet=>{
      const box = scoreMap[bet.matchup_id];
      if (!box) return null;

      const abbr = NAME_TO_ABBR[bet.team_name.toUpperCase()] ?? bet.team_name.toUpperCase();
      let win;
      if (abbr === box.home_abbr) win = box.home > box.away;
      else if (abbr === box.away_abbr) win = box.away > box.home;
      else return null;

      return {
        matchup_id : bet.matchup_id,
        game_date  : gDate,
        team_id    : bet.team_id,
        team_name  : bet.team_name,
        confidence : bet.confidence,
        moneyline  : bet.moneyline,
        stake      : bet.stake,
        to_win     : bet.to_win,
        profit_loss: win ? bet.to_win : -bet.stake,
        outcome    : win ? 'win' : 'loss'
      };
    }).filter(Boolean);

    if (!rows.length)
      return console.log(`⚠️  ${gDate}: nothing graded (team map or scores missing)`);

    const { error } = await supabase
      .from('mlb_daily_results')
      .upsert(rows, { onConflict: 'matchup_id,team_id' });

    if (error) console.error(`❌ ${gDate}:`, error.message);
    else console.log(`✅ ${gDate}: graded ${rows.length} bets`);
  }
}

/* CLI */
if (import.meta.url.endsWith('gradeDailyBets.js')) {
  gradeAll()
    .then(()=>process.exit(0))
    .catch(e=>{console.error(e);process.exit(1);});
}
