import puppeteer from 'puppeteer';
import { supabase, testConnection } from './lib/supabaseClient.js';
import { NAME_TO_ABBR } from './lib/constants.js';  // factor your map out

const THRILLZZ_SEL = '.covers-CoversOdds-lineMovementTable tbody tr';
const AMERICAN_SEL = 'div.American';

async function scrapeLines(matchupId, awayCode, homeCode, browser) {
  // build slug: e.g. sf-at-pit
  const slug = `${awayCode.toLowerCase()}-at-${homeCode.toLowerCase()}`;
  const url  = `https://www.covers.com/sport/baseball/mlb/linemovement/${slug}/${matchupId}`;
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    // grab all rows
    const rows = await page.$$(THRILLZZ_SEL);
    if (!rows.length) return null;

    // map each row to { time: Date, awayLine: int, homeLine: int }
    const data = [];
    for (let row of rows) {
      const tsText = await row.$eval('td:first-child div', el => el.textContent);
      const ts = new Date(tsText.replace(/\(ET\)/,'') + ' ET');

      const [awayLine, homeLine] = await Promise.all([
        row.$eval('td:nth-child(2) ' + AMERICAN_SEL, el => parseInt(el.textContent.trim(),10)),
        row.$eval('td:nth-child(3) ' + AMERICAN_SEL, el => parseInt(el.textContent.trim(),10))
      ]);

      data.push({ ts, awayLine, homeLine });
    }

    // earliest = first element of the array, latest = last
    const first = data[ data.length - 1 ];  // note: Thrillzz tables are reverse-chron
    const last  = data[ 0 ];

    return {
      away: { time_min: first.ts,  line_min: first.awayLine,  time_max: last.ts,  line_max: last.awayLine  },
      home: { time_min: first.ts,  line_min: first.homeLine,  time_max: last.ts,  line_max: last.homeLine  }
    };
  } catch (err) {
    console.error('❌ scrapeLines', matchupId, err);
    return null;
  } finally {
    await page.close();
  }
}

async function fetchAllCLV() {
  if (!(await testConnection())) throw new Error('DB connection failed');

  // 1. pull every bet from mlb_daily_bets for today’s matchups
  const { data: bets } = await supabase
    .from('mlb_daily_bets')
    .select('matchup_id, team_id, team_name, game_date')
    .eq('game_date', new Date().toISOString().slice(0,10)); // or your date filter

  const browser = await puppeteer.launch({ channel:'chrome', headless:'new', args:['--no-sandbox'] });

  for (let b of bets) {
    // standardize the team abbreviation for slug
    const raw = b.team_name.toUpperCase().replace(/\./g,'').trim();
    const abbr = NAME_TO_ABBR[raw] ?? raw;
    // need BOTH away & home codes: query your mlb_daily_bets or mlb_daily_results
    // _for simplicity assume you have away_code and home_code columns_
    const { away, home } = await scrapeLines(b.matchup_id, b.away_code, b.home_code, browser);
    if (!away) continue;

    // upsert away
    await supabase.from('mlb_line_movements').upsert({
      matchup_id:  b.matchup_id,
      team_id:     b.team_id,            // ensure team_id matches away or home
      game_date:   b.game_date,
      source:      'Thrillzz',
      line_time_min: away.time_min,
      line_min:    away.line_min,
      line_time_max: away.time_max,
      line_max:    away.line_max
    }, { onConflict: 'matchup_id,team_id,source' });

    // upsert home
    await supabase.from('mlb_line_movements').upsert({
      matchup_id:  b.matchup_id,
      team_id:     b.home_team_id,
      game_date:   b.game_date,
      source:      'Thrillzz',
      line_time_min: home.time_min,
      line_min:    home.line_min,
      line_time_max: home.time_max,
      line_max:    home.line_max
    }, { onConflict: 'matchup_id,team_id,source' });
  }

  await browser.close();
}

if (import.meta.url.endsWith('fetchLineMovement.js')) {
  fetchAllCLV()
    .then(()=>process.exit(0))
    .catch(e=>{ console.error(e); process.exit(1); });
}
