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

  const sanitize = n => clean(n)
    .replace(/\s+Stats.*$/i, '')           // drop "... Stats …"
    .replace(/\s+Team.*$/i, '')            // drop "... Team …"
    .replace(/\s+Football$/i, '')          // drop trailing "Football"
    .replace(/\s+Game\s*Overview[,]?.*$/i, '') // NEW: drop "Game Overview," junk
    .replace(/[,\|\u2013\u2014\-]+$/g, '') // trim trailing punctuation
    .replace(/\s{2,}/g, ' ')               // collapse spaces
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

  // ---------------------- team dictionary (RESILIENT) ----------------------
  const { data: teams, error: teamErr } = await nfl
    .from('teams')
    .select('team_id,team_name,abbreviation,alt_name');
  if (teamErr) throw new Error(teamErr.message || fmtErr(teamErr));

  const UP = s => String(s || '').toUpperCase().trim();

  // Full official names → id
  const NAME_MAP = Object.fromEntries(
    teams.map(t => [UP(sanitize(t.team_name)), t.team_id])
  );

  // Abbreviations (ignore junk 1-char “abbrs” some pages emit)
  const ABBR_MAP = Object.fromEntries(
    teams
      .filter(t => UP(t.abbreviation).length >= 2)
      .map(t => [UP(t.abbreviation), t.team_id])
  );

  // Nicknames: last token of team_name (e.g., TEXANS, 49ERS), plus alt_name
  const NICK_MAP = {};
  for (const t of teams) {
    const full = UP(sanitize(t.team_name));
    const parts = full.split(/\s+/);
    const nick = parts[parts.length - 1];   // e.g., TEXANS, COWBOYS, 49ERS
    if (nick) NICK_MAP[nick] = t.team_id;

    const alt = UP(sanitize(t.alt_name || ''));
    if (alt) NICK_MAP[alt] = t.team_id;     // e.g., WASHINGTON, JETS (if you store these)
  }

  // fuzzy single-team detector via hub text (as a last resort)
  function uniqueFromHubText(hubText) {
    const HT = UP(hubText || '');
    const found = teams.filter(t => HT.includes(UP(sanitize(t.team_name))));
    return found.length === 1 ? found[0].team_id : null;
  }

  function idFromNameOrAbbr(longName, abbr, hubText) {
    const nameU = UP(sanitize(longName));
    const abbrU = UP(abbr);

    // 1) Exact full name
    if (NAME_MAP[nameU]) return NAME_MAP[nameU];

    // 2) Real abbreviation (>= 2 chars)
    if (abbrU.length >= 2 && ABBR_MAP[abbrU]) return ABBR_MAP[abbrU];

    // 3) Nickname (last word: TEXANS, 49ERS, COWBOYS, etc.)
    const lastWord = nameU.split(/\s+/).pop();
    if (lastWord && NICK_MAP[lastWord]) return NICK_MAP[lastWord];

    // 4) Fallback: unique match in hub text
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
    awayAb = awayAb || deriveAbbr(awayFN);
    homeAb = homeAb || deriveAbbr(homeFN);

    const iso   = $hub('div.covers-CoversMatchupHub-GameInfo time').attr('datetime');
    const gDate = iso ? iso.split('T')[0] : null;

    return { awayFN, homeFN, awayAb, homeAb, gDate, hubText };
  }

  // ---------------------- R-style selectors (relaxed) ----------------------
  // ---- Label-based extractors (robust to row-order/markup tweaks) ----
function normTxt(s) {
  return String(s || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

// Build a map from the stats tables: { 'YARDS/PLAY': { off, def, la }, ... }
function buildStatsMap($) {
  const map = {};

  const toNum = (x) => {
    const v = parseFloat(String(x).replace(/[^\d.\-]/g, ''));
    return Number.isFinite(v) ? v : null;
  };

  // Parse "Key Stats" / "More Stats" tables (structure varies!)
  $('table.stats-table').each((_, tbl) => {
    $(tbl).find('tbody tr').each((__, tr) => {
      const tds = $(tr).find('td');
      if (tds.length < 3) return;

      // 1) Find the label cell (usually 3rd, else the longest text cell)
      let labelIdx = 2;
      if (!tds.eq(labelIdx).text().trim()) {
        let bestLen = -1, bestIdx = -1;
        tds.each((i, td) => {
          const L = normTxt($(td).text()).length;
          if (L > bestLen) { bestLen = L; bestIdx = i; }
        });
        if (bestIdx >= 0) labelIdx = bestIdx;
      }

      const label = normTxt(tds.eq(labelIdx).text());
      if (!label) return;

      // 2) League Avg (LA) = last numeric cell in the row
      let la = null;
      for (let i = tds.length - 1; i > labelIdx; i--) {
        la = toNum(tds.eq(i).text());
        if (la != null) break;
      }

      // 3) OFF = nearest numeric cell to the LEFT of label
      let off = null;
      for (let i = labelIdx - 1; i >= 0; i--) {
        off = toNum(tds.eq(i).text());
        if (off != null) break;
      }

      // 4) DEF = nearest numeric cell to the RIGHT of label (but not LA)
      let def = null;
      for (let i = labelIdx + 1; i < tds.length; i++) {
        const v = toNum(tds.eq(i).text());
        if (v == null) continue;
        // avoid reusing LA if it’s the same cell
        if (la != null && i === tds.length - 1) continue;
        def = v;
        break;
      }

      map[label] = { off, def, la };
    });
  });

  // Merge any standalone "average-table" (sometimes LA lives here)
  $('table.average-table').each((_, tbl) => {
    $(tbl).find('tbody tr').each((__, tr) => {
      const tds = $(tr).find('td');
      if (tds.length < 2) return;
      const label = normTxt(tds.eq(0).text());
      const la    = toNum(tds.eq(1).text());
      if (!label) return;
      map[label] ??= {};
      if (map[label].la == null && la != null) map[label].la = la;
    });
  });

  return map;
}


// Pull one number by label (supporting synonyms) and which column we need
function getStat(map, labels, which) {
  const keys = Array.isArray(labels) ? labels : [labels];
  for (const k of keys) {
    const row = map[normTxt(k)];
    if (row) return which === 'off' ? row.off : which === 'def' ? row.def : row.la;
  }
  return null;
}

async function scrapeRole(id, role) {
  const urlTRUE  = `https://www.covers.com/sport/football/nfl/matchup/${id}/stats-analysis/TRUE/last3`;
  const urlFALSE = `https://www.covers.com/sport/football/nfl/matchup/${id}/stats-analysis/FALSE/last3`;

  // offense page uses OFFENSE column; defense page uses DEFENSE column
  const $off = load((await AX.get(role === 'home' ? urlTRUE  : urlFALSE)).data);
  const $def = load((await AX.get(role === 'home' ? urlFALSE : urlTRUE )).data);

  const offMap = buildStatsMap($off);
  const defMap = buildStatsMap($def);

  // Labels (with synonyms seen on Covers)
  const LBL_YPP = ['YARDS/PLAY', 'YDS/PLAY'];
  const LBL_YPR = ['YARDS/RUSH', 'YDS/RUSH'];
  const LBL_INT = ['INTERCEPTIONS', 'INTERCEPTS'];
  const LBL_FUM = ['FUMBLES'];

  const OFF_YPA = getStat(offMap, LBL_YPP, 'off');
  const LA_YPA  = getStat(offMap, LBL_YPP, 'la');

  const OFF_YRA = getStat(offMap, LBL_YPR, 'off');
  const LA_YRA  = getStat(offMap, LBL_YPR, 'la');

  // TOs: offense page shows OFF ints/fums + LA; defense page shows DEF ints/fums
  const OFF_INT = getStat(offMap, LBL_INT, 'off');
  const OFF_FUM = getStat(offMap, LBL_FUM, 'off');
  const LA_INT  = getStat(offMap, LBL_INT, 'la');
  const LA_FUM  = getStat(offMap, LBL_FUM, 'la');

  const DEF_YPA = getStat(defMap, LBL_YPP, 'def');
  const DEF_YRA = getStat(defMap, LBL_YPR, 'def');
  const DEF_INT = getStat(defMap, LBL_INT, 'def');
  const DEF_FUM = getStat(defMap, LBL_FUM, 'def');

  const need = { OFF_YPA, LA_YPA, OFF_YRA, LA_YRA, OFF_INT, OFF_FUM, LA_INT, LA_FUM, DEF_YPA, DEF_YRA, DEF_INT, DEF_FUM };
  for (const [k, v] of Object.entries(need)) {
    if (v == null || !Number.isFinite(v)) {
      throw new Error(`Missing stat "${k}" for ${id} (${role}); label drift`);
    }
  }

  // Same ratios you were computing
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

    // Robust ID mapping using name, abbr (>=2), nickname, hub text
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
