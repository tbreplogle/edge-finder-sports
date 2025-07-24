/* eslint-disable no-console -------------------------------------------------*/
import axios            from 'axios';
import { load }         from 'cheerio';
import pLimit           from 'p-limit';
import { createClient } from '@supabase/supabase-js';

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */
const sb  = createClient(process.env.SUPABASE_URL,
                         process.env.SUPABASE_SERVICE_ROLE,
                         { auth: { persistSession: false } });

const nfl    = sb.schema('nfl');
const limit  = pLimit(16);
const SEASON = 2024;
const WEEK   = 17;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */
const logPg = e => console.error(
  'STATUS:', e.status, '\nMESSAGE:', e.message,
  '\nDETAIL :', e.details, '\nCODE   :', e.code
);

const safeDivide = (n, d) => Number.isFinite(n / d) ? n / d : d === 0 ? 4 : null;
const clean      = s => s?.replace(/\u00A0/g, ' ').trim();

/* -------------------------------------------------------------------------- */
/*  Pre‑load team metadata                                                    */
/* -------------------------------------------------------------------------- */
const { data: teams, error } = await nfl.from('teams')
  .select('team_id,team_name,abbreviation,alt_name');

if (error) throw error;

const NAME_MAP = Object.fromEntries(teams.map(t => [clean(t.team_name), t.team_id]));
const ABBR_MAP = Object.fromEntries(teams.map(t => [t.abbreviation.toUpperCase(), t.team_id]));

/* resolve id from long / abbr, with city‑only fallback */
function idFromNameOrAbbr(longName, abbr, hubText) {
  const name = clean(longName);
  if (NAME_MAP[name]) return NAME_MAP[name];

  const up = (abbr || '').toUpperCase();
  if (ABBR_MAP[up]) return ABBR_MAP[up];

  /* city‑only fallback: match teams whose name starts with the city
     and whose nickname appears somewhere in the hub page text      */
  const candidates = teams.filter(t =>
    t.team_name.startsWith(name) && hubText.includes(t.alt_name)
  );
  if (candidates.length === 1) return candidates[0].team_id;

  throw new Error(`Unmapped team: "${longName}" / "${abbr}"`);
}

/* -------------------------------------------------------------------------- */
/*  0) Discover matchup IDs                                                   */
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
/*  1) Scrape one matchup                                                     */
/* -------------------------------------------------------------------------- */
async function scrapeMatchup (id) {
  /* hub page for names/date */
  const hubHtml = await axios.get(`https://www.covers.com/sport/football/nfl/matchup/${id}`);
  const $hub    = load(hubHtml.data);

  const hubText = $hub.text();   // for nickname hint

  const node    = role => $hub(`div.matchup-team.${role}-team`);
  const homeFN  = clean(node('home').attr('data-team-fullname'));
  const awayFN  = clean(node('away').attr('data-team-fullname'));
  const homeAb  = clean(node('home').attr('data-team-abbrev'));
  const awayAb  = clean(node('away').attr('data-team-abbrev'));

  const iso     = $hub('div.covers-CoversMatchupHub-GameInfo time').attr('datetime');
  const gDate   = iso ? iso.split('T')[0] : null;

  /* stats pages */
  const stats = flag =>
    `https://www.covers.com/sport/football/nfl/matchup/${id}/stats-analysis/${flag}/last3`;

  const [awayHtml, homeHtml] = await Promise.all([axios.get(stats('FALSE')), axios.get(stats('TRUE'))]);

  const parse = (html, role) => {
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
    rows : [parse(awayHtml,'away'), parse(homeHtml,'home')],
    gameDate : gDate,
    hubText
  };
}

/* -------------------------------------------------------------------------- */
/*  2) Main loop                                                              */
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

  /* last‑3 bulk */
  if (bulk.length) {
    const { error: upErr } = await nfl
      .from('team_last3')
      .upsert(bulk, { onConflict: 'covers_id,team_role' });
    if (upErr) logPg(upErr); else console.log(`🚀 Upserted ${bulk.length} rows`);
  }

  console.log('🎉 Done');
  process.exit(0);
})();
