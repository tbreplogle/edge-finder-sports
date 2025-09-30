/* fetchNflLast3.cjs — Covers “last3” scraper with resilient team mapping */
const fs       = require('fs');
const axios    = require('axios');
const { load } = require('cheerio');

/* ------------ utilities ------------ */
const fmtErr = (e) => {
  if (!e) return 'Unknown error';
  if (e instanceof Error) return e.stack || e.message;
  try { return JSON.stringify(e, null, 2); } catch { return String(e); }
};
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:\n', fmtErr(reason));
  process.exit(1);
});

/* Browsery client to avoid anti-bot HTML */
const AX = axios.create({
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  },
  timeout: 20000,
  validateStatus: s => s >= 200 && s < 400
});

(async () => {
  const { default: pLimit }  = await import('p-limit');
  const { createClient }     = await import('@supabase/supabase-js');

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false }
  });
  const nfl    = sb.schema('nfl');
  const limit  = pLimit(10);

  const clean = s => (s ?? '').replace(/\u00A0/g, ' ').trim();

  // Hardened sanitize: trims “Game Overview,” and trailing punctuation
  const sanitize = n => (String(n ?? ''))
    .replace(/\u00A0/g, ' ')
    .replace(/\s+Stats.*$/i, '')
    .replace(/\s+Team.*$/i, '')
    .replace(/\s+Football$/i, '')
    .replace(/\s+Game\s*Overview[,]?.*$/i, '')
    .replace(/[,\|\u2013\u2014\-]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const EPS = 0.01; // Laplace smoothing for TO ratios
  const ratio = (num, den, eps = EPS) => {
    const d = (den ?? 0) + eps;
    const n = (num ?? 0);
    const r = n / d;
    if (!Number.isFinite(r)) return 4.0;
    return Math.min(r, 4.0);   // cap at 4
  };

  const toNum = (txt) => {
    const n = parseFloat(String(txt).replace(/[^\d.\-]/g, ''));
    if (!Number.isFinite(n)) throw new Error(`Bad number: "${txt}"`);
    return n;
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const todayCT = () =>
    new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));

  const DEBUG = String(process.env.DEBUG || '').toLowerCase() === 'true';

  // ---------------------- dynamic season/week ----------------------
  // Default to week_calendar; allow override via env
  const WEEKS_TABLE_ENV = process.env.NFL_WEEKS_TABLE || 'week_calendar';

  async function getActiveWeek() {
    const tryTables = [WEEKS_TABLE_ENV, 'weeks'].filter((v, i, a) => v && a.indexOf(v) === i);

    let rows = null;
    let used = null;
    let lastErr = null;

    for (const tbl of tryTables) {
      const res = await nfl
        .from(tbl)
        .select('season,week,start,finish')
        .order('start', { ascending: true });
      if (!res.error) { rows = res.data; used = tbl; break; }
      lastErr = res.error;
    }

    if (!rows) {
      throw new Error(
        `Could not read an NFL weeks table (tried: ${tryTables.join(', ')}). ` +
        `Last error: ${lastErr?.code || ''} ${lastErr?.message || ''}`
      );
    }
    if (!rows.length) throw new Error(`No rows in nfl.${used}`);

    const tzNow  = todayCT();
    const today  = new Date(tzNow.toISOString().slice(0,10)); // strip time

    const inWindow = rows.find(r =>
      new Date(r.start) <= today && today <= new Date(r.finish)
    );
    if (inWindow) {
      return {
        season:   inWindow.season,
        week:     inWindow.week,
        startIso: String(inWindow.start),
        finishIso:String(inWindow.finish),
      };
    }

    // choose NEXT upcoming week (start >= today), otherwise last/first
    const next = rows.find(r => new Date(r.start) >= today);
    if (next) {
      return {
        season:   next.season,
        week:     next.week,
        startIso: String(next.start),
        finishIso:String(next.finish),
      };
    }

    const first = rows[0];
    const last  = rows[rows.length - 1];
    const pick  = (today < new Date(first.start)) ? first : last;

    return {
      season:   pick.season,
      week:     pick.week,
      startIso: String(pick.start),
      finishIso:String(pick.finish),
    };
  }

  // ---------------------- team dictionary (ROBUST) ----------------------
  const { data: teams, error: teamErr } = await nfl
    .from('teams')
    .select('team_id,team_name,abbreviation,alt_name');
  if (teamErr) throw new Error(teamErr.message || fmtErr(teamErr));

  const UP = s => String(s || '').toUpperCase().trim();

  // 1) Full names → id
  const NAME_MAP = Object.fromEntries(
    teams.map(t => [UP(sanitize(t.team_name)), t.team_id])
  );

  // 2) Abbreviations (ignore 0/1-char junk like "T","C")
  const ABBR_MAP = Object.fromEntries(
    teams
      .filter(t => UP(t.abbreviation).length >= 2)
      .map(t => [UP(t.abbreviation), t.team_id])
  );

  // 3) Unique nicknames (last word of team_name) + alt_name
  const nickBuckets = new Map(); // NICK -> [team_id,...]
  for (const t of teams) {
    const full = UP(sanitize(t.team_name));
    const parts = full.split(/\s+/);
    const nick  = parts[parts.length - 1];
    if (nick) {
      const arr = nickBuckets.get(nick) || [];
      arr.push(t.team_id);
      nickBuckets.set(nick, arr);
    }
    const alt = UP(sanitize(t.alt_name || ''));
    if (alt) {
      const arr = nickBuckets.get(alt) || [];
      arr.push(t.team_id);
      nickBuckets.set(alt, arr);
    }
  }
  const NICK_MAP = {};
  for (const [nick, arr] of nickBuckets.entries()) {
    if (arr.length === 1) NICK_MAP[nick] = arr[0];
  }

// --- DEBUG: show what we can resolve ---
if (process.env.DEBUG?.toLowerCase() === 'true') {
  const sample = ['TEXANS','COWBOYS','BRONCOS','49ERS','RAIDERS',
                  'TITANS','GIANTS','DOLPHINS','BUCCANEERS','COMMANDERS',
                  'LIONS','PATRIOTS','CHIEFS','VIKINGS'];
  console.log('DBG NAME_MAP has HOUSTON TEXANS?', !!NAME_MAP['HOUSTON TEXANS']);
  console.log('DBG NICK_MAP keys sample:', sample.map(k => [k, !!NICK_MAP[k]]));
}


  // 4) Fallback: unique full-name mention in hub text
  function uniqueFromHubText(hubText) {
    const HT = UP(hubText || '');
    const hits = teams.filter(t => HT.includes(UP(sanitize(t.team_name))));
    return hits.length === 1 ? hits[0].team_id : null;
  }
// ---- HARD NICKNAME ALIASES (derives ids from your teams table) ----
const _BY_FULL = new Map(teams.map(t => [UP(sanitize(t.team_name)), t.team_id]));
const _id = (full) => _BY_FULL.get(UP(full));  // full = "City Nickname"

const HARD_ALIAS = {
  TEXANS:      _id('Houston Texans'),
  COLTS:       _id('Indianapolis Colts'),
  JAGUARS:     _id('Jacksonville Jaguars'),
  TITANS:      _id('Tennessee Titans'),

  CHIEFS:      _id('Kansas City Chiefs'),
  BRONCOS:     _id('Denver Broncos'),
  RAIDERS:     _id('Las Vegas Raiders'),
  CHARGERS:    _id('Los Angeles Chargers'),

  BILLS:       _id('Buffalo Bills'),
  DOLPHINS:    _id('Miami Dolphins'),
  PATRIOTS:    _id('New England Patriots'),
  JETS:        _id('New York Jets'),

  RAVENS:      _id('Baltimore Ravens'),
  BENGALS:     _id('Cincinnati Bengals'),
  BROWNS:      _id('Cleveland Browns'),
  STEELERS:    _id('Pittsburgh Steelers'),

  COWBOYS:     _id('Dallas Cowboys'),
  GIANTS:      _id('New York Giants'),
  EAGLES:      _id('Philadelphia Eagles'),
  COMMANDERS:  _id('Washington Commanders'),

  BEARS:       _id('Chicago Bears'),
  LIONS:       _id('Detroit Lions'),
  PACKERS:     _id('Green Bay Packers'),
  VIKINGS:     _id('Minnesota Vikings'),

  FALCONS:     _id('Atlanta Falcons'),
  PANTHERS:    _id('Carolina Panthers'),
  SAINTS:      _id('New Orleans Saints'),
  BUCCANEERS:  _id('Tampa Bay Buccaneers'),

  CARDINALS:   _id('Arizona Cardinals'),
  RAMS:        _id('Los Angeles Rams'),
  '49ERS':     _id('San Francisco 49ers'),
  SEAHAWKS:    _id('Seattle Seahawks'),
};

// Optional sanity check while DEBUG=true:
if (String(process.env.DEBUG || '').toLowerCase() === 'true') {
  const missing = Object.entries(HARD_ALIAS).filter(([,v]) => !v).map(([k])=>k);
  if (missing.length) console.warn('HARD_ALIAS missing ids for:', missing);
}


  function idFromNameOrAbbr(longName, abbr, hubText) {
    const nameU = UP(sanitize(longName));
    const abbrU = UP(abbr);

    if (NAME_MAP[nameU]) return NAME_MAP[nameU];
    if (abbrU.length >= 2 && ABBR_MAP[abbrU]) return ABBR_MAP[abbrU];

    const lastWord = nameU.split(/\s+/).pop();
    if (lastWord && NICK_MAP[lastWord]) return NICK_MAP[lastWord];

    const id = uniqueFromHubText(hubText);
    if (id) return id;

    throw new Error(`Unmapped team: "${longName}" / "${abbr}"`);
  }

  const deriveAbbr = n => {
    if (!n) return '';
    const caps = n.match(/[A-Z]/g);
    return caps ? caps.slice(-3).join('').toUpperCase() : '';
  };

  // ---------------------- discover matchups (week-wide) ----------------------
  async function discoverMatchupsForDate(dateIso) {
    const url = dateIso
      ? `https://www.covers.com/sports/nfl/matchups?selectedDate=${dateIso}`
      : 'https://www.covers.com/sports/nfl/matchups';

    const res = await AX.get(url);
    const $   = load(res.data);

    const ids = new Set();
    $("a[href*='/sport/football/nfl/matchup/']").each((_, el) => {
      const m = $(el).attr('href')?.match(/matchup\/(\d+)/);
      if (m) ids.add(+m[1]);
    });
    return ids;
  }

  async function discoverWeekIds(startIso, finishIso) {
    const ids = new Set();
    for (let d = new Date(startIso); d <= new Date(finishIso); d.setDate(d.getDate()+1)) {
      const day = d.toISOString().slice(0,10);
      const set = await discoverMatchupsForDate(day);
      for (const id of set) ids.add(id);
      await sleep(150);
    }
    if (!ids.size) throw new Error(`No matchup IDs found ${startIso}…${finishIso}`);
    return [...ids];
  }

  // ---------------------- hub helpers ----------------------
  const namesFromOg = title => {
    const parts = title.split(/\s+vs\.?\s+/i);
    if (parts.length < 2) return [null, null];
    const away = sanitize(parts[0]);
    const home = sanitize(parts[1].split(/\s(?:Odds|Picks|Predictions|Preview|Betting|-\s|\|\s)/i)[0]);
    return [away, home];
  };

  async function getHubInfo(id) {
    const hubRes  = await AX.get(`https://www.covers.com/sport/football/nfl/matchup/${id}`);
    const $hub    = load(hubRes.data);
    const hubText = $hub.text();

    let awayFN = clean($hub('div.matchup-team.away-team').attr('data-team-fullname'));
    let homeFN = clean($hub('div.matchup-team.home-team').attr('data-team-fullname'));
    let awayAb = clean($hub('div.matchup-team.away-team').attr('data-team-abbrev'));
    let homeAb = clean($hub('div.matchup-team.home-team').attr('data-team-abbrev'));

    if (!awayFN || !homeFN) {
      const og = $hub('meta[property="og:title"]').attr('content') || '';
      const [a, h] = namesFromOg(og);
      awayFN = awayFN || a; homeFN = homeFN || h;
    }
    // sanitize before deriving abbr/mapping (kills “Game Overview,” etc.)
    awayFN = sanitize(awayFN);
    homeFN = sanitize(homeFN);

    awayAb = awayAb || deriveAbbr(awayFN);
    homeAb = homeAb || deriveAbbr(homeFN);

    const iso   = $hub('div.covers-CoversMatchupHub-GameInfo time').attr('datetime');
    const gDate = iso ? iso.split('T')[0] : null;

    return { awayFN, homeFN, awayAb, homeAb, gDate, hubText };
  }

  // ---------------------- R-style selectors (your original ones) ----------------------
  const SEL = {
    off: {
      yppa:  'section:nth-of-type(1) table.stats-table.football-stats-table tbody tr:nth-child(11) td:nth-child(1) span',
      yra:   'section:nth-of-type(1) table.stats-table.football-stats-table tbody tr:nth-child(5)  td:nth-child(1) span',
      int:   'section:nth-of-type(2) table.stats-table.football-stats-table tbody tr:nth-child(3)  td:nth-child(1) span',
      fum:   'section:nth-of-type(2) table.stats-table.football-stats-table tbody tr:nth-child(4)  td:nth-child(1) span',
      la_yppa:'section:nth-of-type(1) table.average-table tbody tr:nth-child(11) td',
      la_yra: 'section:nth-of-type(1) table.average-table tbody tr:nth-child(5)  td',
      la_int: 'section:nth-of-type(2) table.average-table tbody tr:nth-child(3)  td',
      la_fum: 'section:nth-of-type(2) table.average-table tbody tr:nth-child(4)  td',
    },
    def: {
      yppa:  'section:nth-of-type(1) table.stats-table.football-stats-table tbody tr:nth-child(11) td:nth-child(5) span',
      yra:   'section:nth-of-type(1) table.stats-table.football-stats-table tbody tr:nth-child(5)  td:nth-child(5) span',
      int:   'section:nth-of-type(2) table.stats-table.football-stats-table tbody tr:nth-child(3)  td:nth-child(5) span',
      fum:   'section:nth-of-type(2) table.stats-table.football-stats-table tbody tr:nth-child(4)  td:nth-child(5) span',
    }
  };

  function variants(sel) {
    return [
      sel,
      sel.replace('.football-stats-table', ''),
      sel.replace('table.stats-table.football-stats-table', 'table.stats-table'),
      sel.replace(/section:nth-of-type\(\d+\)\s+/g, '')
    ];
  }

  const pick = ($, sel) => {
    for (const v of variants(sel)) {
      const el = $(v);
      if (el.length) return toNum(el.first().text());
    }
    throw new Error(`Selector missing: ${sel}`);
  };

  async function fetch$ (url) {
    for (let i=0; i<2; i++) {
      const res = await AX.get(url);
      const $   = load(res.data);
      if ($('table.stats-table').length || $('table.average-table').length) return $;
      if (i === 0) await sleep(600);
    }
    throw new Error(`No stats/average tables found at ${url}`);
  }

  // Build the 6 ratios for a ROLE ("home" or "away") using the nth-child selectors
  async function scrapeRole(id, role) {
    const urlTRUE  = `https://www.covers.com/sport/football/nfl/matchup/${id}/stats-analysis/TRUE/last3`;
    const urlFALSE = `https://www.covers.com/sport/football/nfl/matchup/${id}/stats-analysis/FALSE/last3`;

    // offense page uses column 1; defense page uses column 5
    const $off = await fetch$(role === 'home' ? urlTRUE  : urlFALSE);
    const $def = await fetch$(role === 'home' ? urlFALSE : urlTRUE );

    const OFF_YPA = pick($off, SEL.off.yppa);
    const OFF_YRA = pick($off, SEL.off.yra);
    const OFF_INT = pick($off, SEL.off.int);
    const OFF_FUM = pick($off, SEL.off.fum);

    const LA_YPA  = pick($off, SEL.off.la_yppa);
    const LA_YRA  = pick($off, SEL.off.la_yra);
    const LA_INT  = pick($off, SEL.off.la_int);
    const LA_FUM  = pick($off, SEL.off.la_fum);

    const DEF_YPA = pick($def, SEL.def.yppa);
    const DEF_YRA = pick($def, SEL.def.yra);
    const DEF_INT = pick($def, SEL.def.int);
    const DEF_FUM = pick($def, SEL.def.fum);

    // Ratios with smoothing for TOs
    return {
      yp_pa_off : ratio(OFF_YPA, LA_YPA),
      yp_ra_off : ratio(OFF_YRA, LA_YRA),
      tov_off   : ratio(LA_INT + LA_FUM, OFF_INT + OFF_FUM),

      yp_pa_def : ratio(LA_YPA, DEF_YPA),
      yp_ra_def : ratio(LA_YRA, DEF_YRA),
      tov_def   : ratio(DEF_INT + DEF_FUM, LA_INT + LA_FUM)
    };
  }

  async function scrapeMatchup(id) {
    // Get hub info once so we have names/abbrs + hubText for mapping fallbacks
    const hubRes  = await AX.get(`https://www.covers.com/sport/football/nfl/matchup/${id}`);
    const $hub    = load(hubRes.data);
    const hubText = $hub.text();

    let awayFN = clean($hub('div.matchup-team.away-team').attr('data-team-fullname'));
    let homeFN = clean($hub('div.matchup-team.home-team').attr('data-team-fullname'));
    let awayAb = clean($hub('div.matchup-team.away-team').attr('data-team-abbrev'));
    let homeAb = clean($hub('div.matchup-team.home-team').attr('data-team-abbrev'));

    if (!awayFN || !homeFN) {
      const og = $hub('meta[property="og:title"]').attr('content') || '';
      const parts = og.split(/\s+vs\.?\s+/i);
      if (parts.length >= 2) {
        const away = sanitize(parts[0]);
        const home = sanitize(parts[1].split(/\s(?:Odds|Picks|Predictions|Preview|Betting|-\s|\|\s)/i)[0]);
        awayFN = awayFN || away; homeFN = homeFN || home;
      }
    }

    // sanitize before abbr/mapping
    awayFN = sanitize(awayFN);
    homeFN = sanitize(homeFN);

    awayAb = awayAb || deriveAbbr(awayFN);
    homeAb = homeAb || deriveAbbr(homeFN);

    const iso   = $hub('div.covers-CoversMatchupHub-GameInfo time').attr('datetime');
    const gDate = iso ? iso.split('T')[0] : null;

    const [awayRatios, homeRatios] = await Promise.all([
      scrapeRole(id, 'away'),
      scrapeRole(id, 'home')
    ]);

    const awayRow = {
      covers_id : id, team_role : 'away',
      team_name : awayFN, team_abbr : awayAb, ...awayRatios
    };
    const homeRow = {
      covers_id : id, team_role : 'home',
      team_name : homeFN, team_abbr : homeAb, ...homeRatios
    };

    // sanity: ensure we got real numbers
    const req = ['yp_pa_off','yp_ra_off','tov_off','yp_pa_def','yp_ra_def','tov_def'];
    for (const r of [awayRow, homeRow]) {
      for (const k of req) {
        if (r[k] == null || !Number.isFinite(r[k])) {
          throw new Error(`Null/NaN ${k} for ${id} (${r.team_role})`);
        }
      }
    }

    // Robust ID mapping using name, abbr (>=2), unique nickname, hub text
    awayRow.team_id = idFromNameOrAbbr(awayRow.team_name, awayRow.team_abbr, hubText);
    homeRow.team_id = idFromNameOrAbbr(homeRow.team_name, homeRow.team_abbr, hubText);

    return { rows: [awayRow, homeRow], gameDate: gDate };
  }

  /* ===================== MAIN RUN (wrapped) ===================== */
  try {
    const { season, week, startIso, finishIso } = await getActiveWeek();
    console.log(`📅 Active NFL window → season ${season}, week ${week}, ${startIso}…${finishIso}`);

    const ids = await discoverWeekIds(startIso, finishIso);
    console.log(`⛏️  Found ${ids.length} matchups across week ${week}`);

    const bulk = [];
    const wrote = [];

    await Promise.all(
      ids.map(id => limit(async () => {
        try {
          const { rows, gameDate } = await scrapeMatchup(id);

          const home = rows.find(r => r.team_role === 'home');
          const away = rows.find(r => r.team_role === 'away');

          // upsert matchup
          const up1 = await nfl.from('matchups').upsert({
            covers_id    : id,
            season       : season,
            week         : week,
            game_date    : gameDate,
            home_team    : home.team_name,
            away_team    : away.team_name,
            home_team_id : home.team_id,
            away_team_id : away.team_id
          }, { onConflict: 'covers_id' });
          if (up1.error) throw new Error(up1.error.message || fmtErr(up1.error));

          // Build explicit rows for team_last3 (NO team_abbr key)
          const toT3 = (r) => ({
            covers_id : r.covers_id,
            team_role : r.team_role,
            team_id   : r.team_id,
            team_name : r.team_name,
            yp_pa_off : r.yp_pa_off,
            yp_ra_off : r.yp_ra_off,
            tov_off   : r.tov_off,
            yp_pa_def : r.yp_pa_def,
            yp_ra_def : r.yp_ra_def,
            tov_def   : r.tov_def
          });

          bulk.push(toT3(home), toT3(away));

          wrote.push(id);
          console.log(`✅ wrote matchup ${id}`);
        } catch (e) {
          console.error(String(e?.message || e));
          if (DEBUG) console.error(fmtErr(e));
          console.error(`❌ matchup ${id} failed`);
        }
      }))
    );

    if (bulk.length) {
      const up2 = await nfl.from('team_last3')
        .upsert(bulk, { onConflict: 'covers_id,team_role' });
      if (up2.error) throw new Error(up2.error.message || fmtErr(up2.error));
      console.log(`🚀 Upserted ${bulk.length} rows`);
    } else {
      console.error('⚠️  No rows to upsert (all matchups failed?)');
    }

    try {
      fs.writeFileSync('scrape-result.json', JSON.stringify({
        season, week, window: { startIso, finishIso }, ids: wrote
      }, null, 2));
    } catch {}

    console.log('🎉 Done');
  } catch (fatal) {
    console.error('FATAL:', fmtErr(fatal));
    process.exit(1);
  }
})();
