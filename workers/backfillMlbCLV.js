/* eslint-disable no-console */
import axios from "axios";
import { supabase, testConnection } from "./lib/supabaseClient.js";

/* ───────── config ───────── */
const SPORT_KEY  = "baseball_mlb";
const API_BASE   = "https://api.the-odds-api.com/v4";
const API_KEY    = process.env.ODDS_API_KEY || "907b67e00fc14e6f4a501355026dba0e";
const REGIONS    = "us";
const MARKET_KEY = "h2h";
const BOOKS_PRIO = ["pinnacle","draftkings","fanduel","betmgm","caesars"]; // adjust if you prefer DK-only
const SRC_PREFIX = "OddsAPI";

/* ───────── Odds API team-name → your team_id ───────── */
const TEAM_NAME_TO_ID = {
  "SEATTLE MARINERS": 1, "CLEVELAND GUARDIANS": 2, "PITTSBURGH PIRATES": 3,
  "LOS ANGELES ANGELS": 4, "TORONTO BLUE JAYS": 5, "MIAMI MARLINS": 6,
  "OAKLAND ATHLETICS": 7, "NEW YORK YANKEES": 8, "TAMPA BAY RAYS": 9,
  "MINNESOTA TWINS": 10, "KANSAS CITY ROYALS": 11, "SAN FRANCISCO GIANTS": 12,
  "ARIZONA DIAMONDBACKS": 13, "MILWAUKEE BREWERS": 14, "CHICAGO WHITE SOX": 15,
  "CHICAGO CUBS": 16, "ATLANTA BRAVES": 17, "SAN DIEGO PADRES": 18,
  "HOUSTON ASTROS": 19, "NEW YORK METS": 20, "LOS ANGELES DODGERS": 21,
  "COLORADO ROCKIES": 22, "CINCINNATI REDS": 23, "WASHINGTON NATIONALS": 24,
  "DETROIT TIGERS": 25, "PHILADELPHIA PHILLIES": 26, "ST. LOUIS CARDINALS": 27,
  "TEXAS RANGERS": 28, "BOSTON RED SOX": 29, "BALTIMORE ORIOLES": 30,
};
const NAME_TO_ID = s => TEAM_NAME_TO_ID[(s||"").trim().toUpperCase()] ?? null;

/* ───────── time helpers (CT) ───────── */
const todayCT = () =>
  new Date().toLocaleDateString("en-CA",{ timeZone:"America/Chicago" }); // YYYY-MM-DD

function endOfDayCtToUtcIso(yyyy_mm_dd){
  // take 23:59:59 CT and shift to UTC (CDT ≈ UTC+5)
  const ct = new Date(`${yyyy_mm_dd}T23:59:59`);
  return new Date(ct.getTime() + 5*3600e3).toISOString();
}
function toCtIso(utcIso){
  const d  = new Date(utcIso);
  const ct = new Date(d.toLocaleString("en-US",{ timeZone:"America/Chicago" }));
  // normalize to ISO
  return new Date(ct.getTime() - ct.getTimezoneOffset()*60000)
    .toISOString().replace(/\.\d{3}Z$/, "Z");
}

/* ───────── daily snapshot (events + odds) ─────────
   /v4/historical/sports/{sport}/odds?regions=us&markets=h2h&date=...
   Returns array of events with id, home_team, away_team, commence_time, bookmakers...
   (Requires regions param.)  */
async function fetchHistoricalDay(yyyy_mm_dd){
  const url = `${API_BASE}/historical/sports/${SPORT_KEY}/odds`;
  const params = {
    apiKey: API_KEY,
    regions: REGIONS,
    markets: MARKET_KEY,
    bookmakers: BOOKS_PRIO.slice(0,3).join(","), // keep it cheap
    oddsFormat: "american",
    dateFormat: "iso",
    date: endOfDayCtToUtcIso(yyyy_mm_dd),
  };
  const resp = await axios.get(url, { params, validateStatus:()=>true });
  if (resp.status !== 200 || !Array.isArray(resp.data)) {
    console.warn(`⚠️ Historical day ${yyyy_mm_dd} resp=${resp.status}`);
    return [];
  }
  return resp.data;
}

/* ───────── event snapshot at timestamp (open/close) ─────────
   /v4/historical/sports/{sport}/events/{eventId}/odds?date=...
   Returns a single event snapshot at or before 'date'. */
async function getEventSnapshot(eventId, isoTs){
  const url = `${API_BASE}/historical/sports/${SPORT_KEY}/events/${eventId}/odds`;
  const params = {
    apiKey: API_KEY,
    markets: MARKET_KEY,
    bookmakers: BOOKS_PRIO.join(","),
    oddsFormat: "american",
    dateFormat: "iso",
    date: isoTs
  };
  const resp = await axios.get(url, { params, validateStatus:()=>true });
  if (resp.status !== 200 || !resp.data?.bookmakers?.length) return null;

  for (const want of BOOKS_PRIO) {
    const bm = resp.data.bookmakers.find(b => (b.key||"").toLowerCase() === want);
    const m  = bm?.markets?.find(x => x.key === MARKET_KEY);
    const os = m?.outcomes || [];
    const h  = os.find(o => o.name === resp.data.home_team);
    const a  = os.find(o => o.name === resp.data.away_team);
    if (h?.price != null && a?.price != null) {
      return { book: want, ts: resp.data?.data_aggregated_at ?? isoTs, home_ml: h.price, away_ml: a.price };
    }
  }
  return null;
}

/* find "open": scan 72h → refine to ~15m; lower-bound by earliest bet date (UTC) */
async function findOpenForEvent(eventId, firstPitchUtcIso, lowerBoundUtcIso){
  const CLOSE = new Date(firstPitchUtcIso).getTime();
  const LOWER = new Date(lowerBoundUtcIso).getTime();
  let start = Math.max(CLOSE - 72*3600e3, LOWER);
  const end = CLOSE - 5*60e3;

  let foundAt = null;
  for (let t = start; t <= end; t += 6*3600e3) {
    const snap = await getEventSnapshot(eventId, new Date(t).toISOString());
    if (snap) { foundAt = t; break; }
  }
  if (foundAt == null) return null;

  let lo = start, hi = foundAt, best = foundAt;
  while (hi - lo > 15*60e3) {
    const mid  = lo + Math.floor((hi - lo)/2);
    const snap = await getEventSnapshot(eventId, new Date(mid).toISOString());
    if (snap) { best = mid; hi = mid - 1; } else { lo = mid + 1; }
  }
  return await getEventSnapshot(eventId, new Date(best).toISOString());
}

/* closing snapshot = <= (first pitch - 60s) */
async function findCloseForEvent(eventId, firstPitchUtcIso){
  const closeTs = new Date(new Date(firstPitchUtcIso).getTime() - 60e3).toISOString();
  return await getEventSnapshot(eventId, closeTs);
}

/* ───────── main ───────── */
async function backfillCLV(){
  if (!(await testConnection())) throw new Error("DB connection failed");

  const today = todayCT();

  // lower bound = earliest bet date
  const { data: minRow, error: minErr } = await supabase
    .from("mlb_daily_bets").select("game_date").order("game_date",{ascending:true}).limit(1).single();
  if (minErr) throw minErr;
  if (!minRow?.game_date) { console.log("▶︎ No bets; nothing to do."); return; }

  const earliest = minRow.game_date;
  console.log(`⏱️  Backfill window (CT): ${earliest} → ${today}`);

  // Pull all past bets; build (date → list of matchups) using only matchup_id + the two team_ids we need
  const { data: bets, error: betsErr } = await supabase
    .from("mlb_daily_bets")
    .select("matchup_id, team_id, game_date")
    .gte("game_date", earliest)
    .lt("game_date", today);
  if (betsErr) throw betsErr;

  // Reduce to: byDate[date] = { [matchup_id]: Set(team_ids) }
  const byDate = new Map();
  for (const b of (bets||[])) {
    const d = b.game_date;
    const map = byDate.get(d) || new Map();
    const set = map.get(b.matchup_id) || new Set();
    set.add(b.team_id);
    map.set(b.matchup_id, set);
    byDate.set(d, map);
  }
  if (!byDate.size) { console.log("▶︎ Nothing to backfill (no past bets)."); return; }

  // Fetch already present CLV rows to skip
  const { data: have, error: haveErr } = await supabase
    .from("mlb_line_movements")
    .select("matchup_id, team_id")
    .gte("game_date", earliest)
    .lt("game_date", today);
  if (haveErr) throw haveErr;
  const done = new Set((have||[]).map(r => `${r.matchup_id}::${r.team_id}`));

  // global lower bound UTC for open-search (start of earliest day CT → UTC)
  const lowerBoundUtc = new Date(`${earliest}T00:00:00Z`).toISOString();

  let upserts = 0;

  for (const [date, midMap] of byDate) {
    // 1) fetch one historical snapshot for this date (events list with IDs)
    const events = await fetchHistoricalDay(date);
    if (!events.length) {
      console.warn(`⚠️ No historical snapshot for ${date}`);
      continue;
    }

    // 2) index events by (home_id, away_id); keep both orders for matching
    const fwd = new Map(); // "home_away" → [events sorted by commence_time]
    const rev = new Map(); // "away_home" → [events sorted by commence_time]
    for (const ev of events) {
      const h = NAME_TO_ID(ev.home_team), a = NAME_TO_ID(ev.away_team);
      if (!h || !a) continue;
      (fwd.get(`${h}_${a}`) ?? fwd.set(`${h}_${a}`, []).get(`${h}_${a}`)).push(ev);
      (rev.get(`${a}_${h}`) ?? rev.set(`${a}_${h}`, []).get(`${a}_${h}`)).push(ev);
    }
    for (const list of [...fwd.values(), ...rev.values()]) {
      list.sort((x,y) => (x.commence_time||"").localeCompare(y.commence_time||""));
    }

    // 3) deterministically assign each matchup_id → an event
    const usedEventIds = new Set();
    const pairs = []; // { matchup_id, event, home_id, away_id }
    const midsSorted = Array.from(midMap.keys()).sort((a,b)=>a-b);

    for (const mid of midsSorted) {
      const ids = Array.from(midMap.get(mid) || []);
      if (ids.length !== 2) { console.warn(`⚠️ mid=${mid} on ${date} has ${ids.length} teams`); continue; }
      const [t1, t2] = ids;

      let candidate = (fwd.get(`${t1}_${t2}`) || []).find(e => !usedEventIds.has(e.id));
      let order = "t1@t2";
      if (!candidate) { candidate = (fwd.get(`${t2}_${t1}`) || []).find(e => !usedEventIds.has(e.id)); order = "t2@t1"; }
      if (!candidate) { candidate = (rev.get(`${t1}_${t2}`) || []).find(e => !usedEventIds.has(e.id)); order = "t1@t2"; }
      if (!candidate) { candidate = (rev.get(`${t2}_${t1}`) || []).find(e => !usedEventIds.has(e.id)); order = "t2@t1"; }

      if (!candidate) {
        console.warn(`⚠️ No event match for mid=${mid} on ${date} (teams ${t1},${t2})`);
        continue;
      }
      usedEventIds.add(candidate.id);

      const home_id = NAME_TO_ID(candidate.home_team);
      const away_id = NAME_TO_ID(candidate.away_team);
      pairs.push({ matchup_id: mid, event: candidate, home_id, away_id, order });
    }

    if (!pairs.length) continue;

    // 4) for each assigned event → compute open/close and upsert per team in that matchup
    for (const p of pairs) {
      const firstPitchUtc = new Date(new Date(p.event.commence_time).getTime()).toISOString();

      const closeSnap = await findCloseForEvent(p.event.id, firstPitchUtc);
      if (!closeSnap) {
        console.warn(`⚠️ No closing snapshot for event ${p.event.id} (mid=${p.matchup_id})`);
        continue;
      }
      const openSnap  = await findOpenForEvent(p.event.id, firstPitchUtc, lowerBoundUtc);

      // Write two rows (home & away) — but only if that team_id exists in your bets for this matchup/date
      const teamIds = Array.from(midMap.get(p.matchup_id) || []);

      const writeOne = async (team_id, isHome) => {
        if (!teamIds.includes(team_id)) return; // only write rows for your bets
        const line_min = isHome ? openSnap?.home_ml : openSnap?.away_ml;
        const time_min = openSnap?.ts;
        const line_max = isHome ? closeSnap.home_ml : closeSnap.away_ml;
        const time_max = closeSnap.ts;

        // NOT NULL guard: if open missing, fall back to close
        const payload = {
          matchup_id: p.matchup_id,
          team_id,
          game_date: date,
          source: `${SRC_PREFIX}:${closeSnap.book}`,
          line_time_min: (time_min ?? time_max),
          line_min:      (line_min ?? line_max),
          line_time_max: time_max,
          line_max:      line_max
        };

        // Skip if we already have a row (avoid duplicate work)
        if (done.has(`${p.matchup_id}::${team_id}`)) return;

        const { error: upErr } = await supabase
          .from("mlb_line_movements")
          .upsert(payload, { onConflict: "matchup_id,team_id,source" });
        if (upErr) console.error("❌ upsert failed", upErr);
        else { upserts++; done.add(`${p.matchup_id}::${team_id}`); }
      };

      await writeOne(p.home_id, true);
      await writeOne(p.away_id, false);
    }
  }

  console.log(`✅ Backfill complete. Upserts: ${upserts}`);
}

/* CLI */
if (import.meta.url.endsWith("backfillMlbCLV.js")) {
  console.log("▶︎ Backfilling CLV (past games)");
  backfillCLV()
    .then(()=>process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
