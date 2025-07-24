/* eslint-disable no-console -------------------------------------------------*/
import axios            from 'axios';
import { load }         from 'cheerio';
import pLimit           from 'p-limit';
import { createClient } from '@supabase/supabase-js';

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */
const sb  = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

const nfl    = sb.schema('nfl');
const limit  = pLimit(16);
const SEASON = 2024;
const WEEK   = 17;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */
const safeDivide = (n, d) => Number.isFinite(n / d) ? n / d : d === 0 ? 4 : null;
const clean      = s => s?.replace(/\u00A0/g, ' ').trim();   // strip NBSP

const logPg = e => console.error(
  'STATUS:', e.status,
  '\nMESSAGE:', e.message,
  '\nDETAIL :', e.details,
  '\nCODE   :', e.code
);

/* -------------------------------------------------------------------------- */
/*  Team dictionary                                                            */
/* -------------------------------------------------------------------------- */
const { data: teams, error } = await nfl
  .from('teams')
  .select('team_id,team_name,abbreviation,alt_name');

if (error) throw error;

const NAME_MAP = Object.fromEntries(teams.map(t => [clean(t.team_name), t.team_id]));
const ABBR_MAP = Object.fromEntries(teams.map(t => [t.abbreviation.toUpperCase(), t.team_id]));

/* long / abbr ➜ id (with city‑only fallback) */
function idFromNameOrAbbr(longName, abbr, hubText) {
  const name = clean(longName);
  if (NAME_MAP[name]) return NAME_MAP[name];

  const up = (abbr || '').toUpperCase();
  if (ABBR_MAP[up]) return ABBR_MAP[up];

  const cand = teams.filter(t =>
    t.team_name.startsWith(name) && hubText.includes(t.alt_name)
  );
  if (cand.length === 1) return cand[0].team_id;
  throw new Error(`Unmapped team: "${longName}" / "${abbr}"`);
}

/* derive 3‑letter abbreviation */
const deriveAbbr = n => {
  if (!n) return '';
  const caps = n.match(/[A-Z]/g);
  return caps ? caps.slice(-3).join('').toUpperCase() : '';
};

/* -------------------------------------------------------------------------- */
/*  Discover matchup IDs                                                      */
/* -------------------------------------------------------------------------- */
async function discoverMatchups () {
  const $ = load((await axios.get('https://www.covers.com/sports/nfl/matchups')).data);
  const ids = new Set();
  $("a[href*='/sport/football/nfl/matchup/']").each((_, el) => {
    const m = $(el).attr('href').match(/matchup\/(\d+)/);
    if (m) ids.add(+m[1]);
  });
  if (!ids.size) throw new Error('Covers markup changed — no matchup IDs');
  return [...ids];
}

/* -------------------------------------------------------------------------- */
/*  Parse two club names from og:title                                         */
/* -------------------------------------------------------------------------- */
function namesFromOg(title) {
  const parts = title.split(/\s+vs\.?\s+/i);
  if (parts.length < 2) return [null, null];
  const away = clean(parts[0]);
  /* cut at first token after nickname (“Odds”, “Picks”, “Preview”, “|”, “–”) */
  const home = clean(
    parts[1]
      .split(/\s(?:Odds|Picks|Predictions|Preview|Betting|-\s|\|\s)/i)[0]
  );
  return [away, home];
}

/* -------------------------------------------------------------------------- */
/*  Scrape one matchup                                                        */
/* -------------------------------------------------------------------------- */
async function scrapeMatchup (id) {
  /* hub page: names & date */
  const hubHtml = await axios.get(`https://www.covers.com/sport/football/nfl/matchup/${id}`);
  const $hub    = load(hubHtml.data);
  const hubText = $hub.text();

  let awayFN = clean($hub('div.matchup-team.away-team').attr('data-team-fullname'));
  let homeFN = clean($hub('div.matchup-team.home-team').attr('data-team-fullname'));
  let awayAb = clean($hub('div.matchup-team.away-team').attr('data-team-abbrev'));
  let homeAb = clean($hub('div.matchup-team.home-team').attr('data-team-abbrev'));

  if (!awayFN || !homeFN) {
    const og = $hub('meta[property="og:title"]').attr('content') || '';
    [awayFN, homeFN] = namesFromOg(og);
  }
  awayAb = awayAb || deriveAbbr(awayFN);
  homeAb = homeAb || deriveAbbr(homeFN);

  const iso   = $hub('div.covers-CoversMatchupHub-GameInfo time').attr('datetime');
  const gDate = iso ? iso.split('T')[0] : null;

  /* stats pages */
  const stats = f => `https://www.covers.com/sport/football/nfl/matchup/${id}/stats-analysis/${f}/last3`;
  const [awayStats, homeStats] = await Promise.all([axios.get(stats('FALSE')), axios.get(stats('TRUE'))]);

  const parseSide = (html, role) => {
    const $ = load(html.data);
    const pick = (r,c) => +$('table.stats-table tbody tr').eq(r).find('td').eq(c).text().trim() || 0;
    const avg  = r     => +$('table.average-table tbody tr').eq(r).find('td').text().trim() || 0;
    return {
      covers_id : id,
      team_role : role,
      team_name : role === 'home' ? homeFN : awayFN,
      team_abbr : role === 'home' ? homeAb : awayAb,
      yp_pa_off : safeDivide(pick(10,0), avg(10)),
      yp_ra_off : safeDivide(pick(4,0),  avg(4)),
      tov_off   : safeDivide(avg(2)+avg(3), pick(2,0)+pick(3,0)),
      yp_pa_def : safeDivide(avg(10), pick(10,4)),
      yp_ra_def : safeDivide(avg(4),  pick(4,4)),
      tov_def   : safeDivide(pick(2,4)+pick(3,4), avg(2)+avg(3))
    };
  };

  return {
    rows     : [parseSide(awayStats,'away'), parseSide(homeStats,'home')],
    gameDate : gDate,
    hubText
  };
}

/* -------------------------------------------------------------------------- */
/*  Main                                                                      */
/* -------------------------------------------------------------------------- */
(async () => {
  const ids = await discoverMatchups();
  console.log(`⛏️  Found ${ids.length} matchups for week ${WEEK}`);

  const bulk = [];

  await Promise.all(ids.map(id => limit(async () => {
    try {
      const { rows, gameDate, hubText } = await scrapeMatchup(id);

      const home = rows.find(r => r.team_role === 'home');
      const away = rows.find(r => r.team_role === 'away');

      home.team_id = idFromNameOrAbbr(home.team_name, home.team_abbr, hubText);
      away.team_id = idFromNameOrAbbr(away.team_name, away.team_abbr, hubText);

      bulk.push(home, away);

      await nfl.from('matchups').upsert({
        covers_id    : id,
        season       : SEASON,
        week         : WEEK,
        game_date    : gameDate,
        home_team_id : home.team_id,
        away_team_id : away.team_id
      }, { onConflict: 'covers_id' }).throwOnError();

      console.log(`✅ wrote matchup ${id}`);
    } catch (e) {
      logPg(e);
      console.error(`❌ matchup ${id} failed`);
    }
  })));

  /* bulk write ratios ---------------------------------------------------- */
  if (bulk.length) {
    const { error: upErr } = await nfl
      .from('team_last3')
      .upsert(bulk, { onConflict: 'covers_id,team_role' });
    if (upErr) logPg(upErr); else console.log(`🚀 Upserted ${bulk.length} rows`);
  }

  console.log('🎉 Done');
  process.exit(0);
})();
