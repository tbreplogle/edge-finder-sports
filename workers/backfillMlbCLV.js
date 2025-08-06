import axios from "axios";
import { load as cheerioLoad } from "cheerio";
import { supabase, testConnection } from "./lib/supabaseClient.js";

const API_KEY = process.env.ODDS_API_KEY || "907b67e00fc14e6f4a501355026dba0e";
const API_BASE = "https://api.the-odds-api.com/v4";
const SPORT_KEY = "baseball_mlb";
const REGIONS = "us";
const MARKET = "h2h";
const BOOKMAKER = "draftkings";
const SRC = "OddsAPI:draftkings";

const TEAM_NAME_TO_ID = {
  "SEATTLE MARINERS": 1, "SEATTLE": 1, "SEA": 1,
  "CLEVELAND GUARDIANS": 2, "CLEVELAND": 2, "GUARDIANS": 2, "CLE": 2,
  "PITTSBURGH PIRATES": 3, "PITTSBURGH": 3, "PIRATES": 3, "PIT": 3,
  "LOS ANGELES ANGELS": 4, "LA ANGELS": 4, "ANGELS": 4, "LAA": 4,
  "TORONTO BLUE JAYS": 5, "TORONTO": 5, "BLUE JAYS": 5, "TOR": 5,
  "MIAMI MARLINS": 6, "MIAMI": 6, "MARLINS": 6, "MIA": 6,
  "OAKLAND ATHLETICS": 7, "OAKLAND": 7, "ATHLETICS": 7, "A'S": 7, "OAK": 7,
  "NEW YORK YANKEES": 8, "YANKEES": 8, "NY YANKEES": 8, "NYY": 8,
  "TAMPA BAY RAYS": 9, "TAMPA BAY": 9, "RAYS": 9, "TB": 9, "TBR": 9,
  "MINNESOTA TWINS": 10, "MINNESOTA": 10, "TWINS": 10, "MIN": 10,
  "KANSAS CITY ROYALS": 11, "KANSAS CITY": 11, "ROYALS": 11, "KC": 11, "KCR": 11,
  "SAN FRANCISCO GIANTS": 12, "SAN FRANCISCO": 12, "GIANTS": 12, "SF": 12, "SFG": 12,
  "ARIZONA DIAMONDBACKS": 13, "ARIZONA": 13, "DIAMONDBACKS": 13, "D-BACKS": 13, "ARI": 13, "AZ": 13,
  "MILWAUKEE BREWERS": 14, "MILWAUKEE": 14, "BREWERS": 14, "MIL": 14,
  "CHICAGO WHITE SOX": 15, "WHITE SOX": 15, "CHI WHITE SOX": 15, "CWS": 15, "CHW": 15,
  "CHICAGO CUBS": 16, "CHICAGO CUBS": 16, "CUBS": 16, "CHI CUBS": 16, "CHC": 16,
  "ATLANTA BRAVES": 17, "ATLANTA": 17, "BRAVES": 17, "ATL": 17,
  "SAN DIEGO PADRES": 18, "SAN DIEGO": 18, "PADRES": 18, "SD": 18, "SDP": 18,
  "HOUSTON ASTROS": 19, "HOUSTON": 19, "ASTROS": 19, "HOU": 19,
  "NEW YORK METS": 20, "METS": 20, "NY METS": 20, "NYM": 20,
  "LOS ANGELES DODGERS": 21, "LOS ANGELES": 21, "LA DODGERS": 21, "DODGERS": 21, "LAD": 21,
  "COLORADO ROCKIES": 22, "COLORADO": 22, "ROCKIES": 22, "COL": 22,
  "CINCINNATI REDS": 23, "CINCINNATI": 23, "REDS": 23, "CIN": 23,
  "WASHINGTON NATIONALS": 24, "WASHINGTON": 24, "NATIONALS": 24, "WAS": 24, "WSH": 24,
  "DETROIT TIGERS": 25, "DETROIT": 25, "TIGERS": 25, "DET": 25,
  "PHILADELPHIA PHILLIES": 26, "PHILADELPHIA": 26, "PHILLIES": 26, "PHI": 26,
  "ST. LOUIS CARDINALS": 27, "ST LOUIS": 27, "SAINT LOUIS": 27, "CARDINALS": 27, "STL": 27,
  "TEXAS RANGERS": 28, "TEXAS": 28, "RANGERS": 28, "TEX": 28,
  "BOSTON RED SOX": 29, "BOSTON": 29, "RED SOX": 29, "BOS": 29,
  "BALTIMORE ORIOLES": 30, "BALTIMORE": 30, "ORIOLES": 30, "BAL": 30
};

const norm = (s) => (s || "").toUpperCase().replace(/[^A-Z\s]/g, "").replace(/\s+/g, " ").trim();
const nameToId = (s) => TEAM_NAME_TO_ID[norm(s)] ?? null;
const todayCT = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const toIso = (t) => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
const ctStartToUtc = (date) => `${date}T05:00:00Z`;

async function getBetsWindow() {
  const { data: minRow, error } = await supabase.from("mlb_daily_bets").select("game_date").order("game_date", { ascending: true }).limit(1).single();
  if (error) throw error;
  if (!minRow?.game_date) return null;
  return { start: minRow.game_date, end: todayCT() };
}

async function listMidsByDate(start, end) {
  const { data, error } = await supabase.from("mlb_daily_bets").select("matchup_id, team_id, game_date").gte("game_date", start).lt("game_date", end);
  if (error) throw error;
  const byDate = new Map();
  for (const r of data || []) {
    if (!byDate.has(r.game_date)) byDate.set(r.game_date, new Map());
    const m = byDate.get(r.game_date);
    if (!m.has(r.matchup_id)) m.set(r.matchup_id, new Set());
    m.get(r.matchup_id).add(r.team_id);
  }
  return byDate;
}

async function getTeamsFromMatchups(mid) {
  const { data, error } = await supabase.from("mlb_matchups").select("home_team_id, away_team_id").eq("matchup_id", mid).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { home_team_id, away_team_id } = data;
  if (home_team_id && away_team_id) return { home_team_id, away_team_id };
  return null;
}

async function getTeamsFromResults(mid) {
  const { data, error } = await supabase.from("mlb_daily_results").select("team_id").eq("matchup_id", mid);
  if (error) throw error;
  const ids = Array.from(new Set((data || []).map((r) => r.team_id)));
  if (ids.length === 2) return { home_team_id: ids[0], away_team_id: ids[1] };
  return null;
}

async function getTeamsFromBetsAnyDate(mid) {
  const { data, error } = await supabase.from("mlb_daily_bets").select("team_id").eq("matchup_id", mid);
  if (error) throw error;
  const ids = Array.from(new Set((data || []).map((r) => r.team_id)));
  if (ids.length === 2) return { home_team_id: ids[0], away_team_id: ids[1] };
  return null;
}

async function scrapeTeamsFromCovers(mid) {
  const url = `https://www.covers.com/sport/baseball/mlb/boxscore/${mid}`;
  const resp = await axios.get(url, { timeout: 20000, validateStatus: () => true });
  if (resp.status !== 200) return null;
  const $ = cheerioLoad(resp.data);
  const away = $(".covers-CoversMatchupDetails-awayName").first().text().trim() || $("a.covers-CoversMatchups-uppercaseHelper").first().text().trim();
  const home = $(".covers-CoversMatchupDetails-homeName").first().text().trim() || $("a.covers-CoversMatchups-uppercaseHelper").eq(1).text().trim();
  const awayId = nameToId(away);
  const homeId = nameToId(home);
  if (homeId && awayId) return { home_team_id: homeId, away_team_id: awayId };
  return null;
}

async function ensureTeamsForMid(mid) {
  const m = await getTeamsFromMatchups(mid);
  if (m) return m;
  const r = await getTeamsFromResults(mid);
  if (r) return r;
  const b = await getTeamsFromBetsAnyDate(mid);
  if (b) return b;
  const s = await scrapeTeamsFromCovers(mid);
  if (s) {
    await supabase.from("mlb_matchups").update({ home_team_id: s.home_team_id, away_team_id: s.away_team_id }).eq("matchup_id", mid);
    return s;
  }
  return null;
}

async function fetchSnapshot(params) {
  const r = await axios.get(`${API_BASE}/historical/sports/${SPORT_KEY}/odds`, { params, validateStatus: () => true, timeout: 30000 });
  if (r.status !== 200) return null;
  const list = Array.isArray(r.data) ? r.data : r.data?.data;
  return Array.isArray(list) ? list : null;
}

async function fetchHistoricalDayUnion(date) {
  const stamps = [`${date}T05:30:00Z`, `${date}T12:00:00Z`, `${date}T18:00:00Z`, `${date}T23:59:00Z`];
  const out = new Map();
  for (const stamp of stamps) {
    const params = { apiKey: API_KEY, regions: REGIONS, markets: MARKET, bookmakers: BOOKMAKER, oddsFormat: "american", date: stamp };
    const list = await fetchSnapshot(params);
    if (!list) continue;
    for (const ev of list) out.set(ev.id, ev);
  }
  return Array.from(out.values());
}

function bucketEventsByTeams(events) {
  const buckets = new Map();
  for (const e of events) {
    const h = nameToId(e.home_team);
    const a = nameToId(e.away_team);
    if (!h || !a) continue;
    const k = `${h}_${a}`;
    (buckets.get(k) ?? buckets.set(k, []).get(k)).push(e);
  }
  for (const list of buckets.values()) {
    list.sort((x, y) => (x.commence_time || "").localeCompare(y.commence_time || ""));
  }
  return buckets;
}

async function snapEvent(eventId, iso) {
  const params = { apiKey: API_KEY, regions: REGIONS, markets: MARKET, bookmakers: BOOKMAKER, oddsFormat: "american", date: iso };
  const r = await axios.get(`${API_BASE}/historical/sports/${SPORT_KEY}/events/${eventId}/odds`, { params, validateStatus: () => true, timeout: 25000 });
  if (r.status !== 200 || !r.data?.bookmakers?.length) return null;
  const b = r.data.bookmakers.find((x) => (x.key || "").toLowerCase() === BOOKMAKER);
  const m = b?.markets?.find((mm) => mm.key === MARKET);
  const os = m?.outcomes || [];
  const h = os.find((o) => o.name === r.data.home_team)?.price;
  const a = os.find((o) => o.name === r.data.away_team)?.price;
  if (h == null || a == null) return null;
  return { ts: r.data?.data_aggregated_at || iso, home: Math.round(Number(h)), away: Math.round(Number(a)), home_name: r.data.home_team, away_name: r.data.away_team };
}

async function findClose(eventId, firstPitchUtc) {
  const t0 = new Date(firstPitchUtc).getTime();
  const offsets = [60e3, 5 * 60e3, 15 * 60e3, 30 * 60e3, 60 * 60e3, 120 * 60e3];
  for (const off of offsets) {
    const s = await snapEvent(eventId, toIso(t0 - off));
    if (s) return s;
  }
  return null;
}

async function findOpen(eventId, firstPitchUtc, lowerBoundUtc) {
  const t1 = new Date(firstPitchUtc).getTime();
  const lb = new Date(lowerBoundUtc).getTime();
  const start = Math.max(t1 - 72 * 3600e3, lb);
  const probes = [72, 60, 48, 36, 24, 18, 12, 8, 6, 4, 2].map((h) => t1 - h * 3600e3).filter((t) => t >= start);
  let best = null;
  for (let i = probes.length - 1; i >= 0; i--) {
    const s = await snapEvent(eventId, toIso(probes[i]));
    if (s) best = s;
  }
  return best;
}

async function upsertMovement(mid, team_id, date, open, close) {
  const homeRefId = nameToId(close.home_name);
  const isHome = team_id === homeRefId;
  const line_time_min = open?.ts ?? close?.ts ?? null;
  const line_min = open ? (isHome ? open.home : open.away) : (isHome ? close.home : close.away);
  const line_time_max = close?.ts ?? open?.ts ?? null;
  const line_max = isHome ? close.home : close.away;
  if (!line_time_min || line_min == null || !line_time_max || line_max == null) return false;
  const { error } = await supabase.from("mlb_line_movements").upsert({
    matchup_id: mid,
    team_id,
    game_date: date,
    source: SRC,
    line_time_min,
    line_min,
    line_time_max,
    line_max
  }, { onConflict: "matchup_id,team_id,source" });
  if (error) {
    console.error("❌ upsert failed", error);
    return false;
  }
  return true;
}

async function backfill() {
  if (!(await testConnection())) throw new Error("DB connection failed");
  if (!API_KEY) throw new Error("ODDS_API_KEY missing");
  const win = await getBetsWindow();
  if (!win) return;
  const { start, end } = win;
  console.log(`⏱️  Backfill window (CT): ${start} → ${end}`);
  const byDate = await listMidsByDate(start, end);
  const have = await supabase.from("mlb_line_movements").select("matchup_id, team_id, source, game_date").gte("game_date", start).lt("game_date", end);
  if (have.error) throw have.error;
  const done = new Set((have.data || []).filter((r) => r.source === SRC).map((r) => `${r.matchup_id}::${r.team_id}`));
  const lowerBoundUtc = ctStartToUtc(start);
  let upserts = 0;

  for (const [date, midMap] of byDate) {
    const events = await fetchHistoricalDayUnion(date);
    if (!events.length) {
      console.warn(`⚠️ No historical snapshot for ${date}`);
      continue;
    }
    const buckets = bucketEventsByTeams(events);
    const used = new Set();

    for (const [mid, teamSet] of midMap) {
      const ids = Array.from(teamSet || []);
      let home_team_id = null, away_team_id = null;
      if (ids.length === 2) { home_team_id = ids[0]; away_team_id = ids[1]; }
      else {
        const pair = await ensureTeamsForMid(mid);
        if (pair) { home_team_id = pair.home_team_id; away_team_id = pair.away_team_id; }
        else { continue; }
      }

      const k1 = `${home_team_id}_${away_team_id}`;
      const k2 = `${away_team_id}_${home_team_id}`;
      const candidates = (buckets.get(k1) || []).concat(buckets.get(k2) || []);
      if (!candidates.length) { console.warn(`⚠️ No event match for mid=${mid} on ${date} (teams ${home_team_id},${away_team_id})`); continue; }

      let pick = null;
      for (const ev of candidates) {
        const d = new Date(ev.commence_time).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
        if (d === date && !used.has(ev.id)) { pick = ev; break; }
      }
      if (!pick) pick = candidates.find(ev => !used.has(ev.id)) || candidates[0];
      used.add(pick.id);

      const firstPitchUtc = new Date(pick.commence_time).toISOString();
      const close = await findClose(pick.id, firstPitchUtc);
      if (!close) { console.warn(`⚠️ No closing snapshot for event ${pick.id} (mid=${mid})`); continue; }
      const open = await findOpen(pick.id, firstPitchUtc, lowerBoundUtc);

      const home_id_from_snap = nameToId(close.home_name);
      const away_id_from_snap = nameToId(close.away_name);
      if (!home_id_from_snap || !away_id_from_snap) continue;

      if (!done.has(`${mid}::${home_id_from_snap}`)) {
        const ok = await upsertMovement(mid, home_id_from_snap, date, open, close);
        if (ok) { done.add(`${mid}::${home_id_from_snap}`); upserts++; }
      }
      if (!done.has(`${mid}::${away_id_from_snap}`)) {
        const ok = await upsertMovement(mid, away_id_from_snap, date, open, close);
        if (ok) { done.add(`${mid}::${away_id_from_snap}`); upserts++; }
      }
    }
  }

  console.log(`✅ Backfill complete. Upserts: ${upserts}`);
}

if (import.meta.url.endsWith("backfillMlbCLV.js")) {
  console.log("▶︎ Backfilling CLV (past games)");
  backfill().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
