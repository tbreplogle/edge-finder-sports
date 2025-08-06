/* eslint-disable no-console */
import axios from "axios";
import { supabase, testConnection } from "./lib/supabaseClient.js";

/* ───────── config ───────── */
const SPORT_KEY  = "baseball_mlb";
const API_BASE   = "https://api.the-odds-api.com/v4";
const API_KEY    = process.env.ODDS_API_KEY || "907b67e00fc14e6f4a501355026dba0e";
const REGIONS    = "us";
const MARKET_KEY = "h2h";
const BOOKS_PRIO = ["draftkings"]; // change if you prefer
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

/* ───────── odds helper ───────── */
function toAmerican(price) {
  // Accept American (int) or Decimal (float ≥1.01); normalize to American int.
  if (price == null) return null;
  if (typeof price === "number" && (price > 10 || price < -1)) return Math.round(price); // looks American already
  const dec = Number(price);
  if (!isFinite(dec) || dec <= 1.0) return null;
  // decimal → american
  return dec >= 2 ? Math.round((dec - 1) * 100) : Math.round(-100 / (dec - 1));
}

/* ───────── time helpers (CT) ───────── */
const todayCT = () =>
  new Date().toLocaleDateString("en-CA",{ timeZone:"America/Chicago" }); // YYYY-MM-DD

function ctStartUtc(yyyy_mm_dd) { return new Date(`${yyyy_mm_dd}T05:00:00Z`).toISOString(); } // ~00:00 CT in season
function dayProbeUtc(yyyy_mm_dd) { return new Date(`${yyyy_mm_dd}T05:30:00Z`).toISOString(); } // your working example

function toCtIso(utcIso){
  const d  = new Date(utcIso);
  const ct = new Date(d.toLocaleString("en-US",{ timeZone:"America/Chicago" }));
  return new Date(ct.getTime() - ct.getTimezoneOffset()*60000)
    .toISOString().replace(/\.\d{3}Z$/, "Z");
}

/* ───────── DAILY SNAPSHOT (events list) ─────────
   MATCHES YOUR WORKING CALL SHAPE:
   /v4/historical/sports/{sport}/odds?apiKey=...&regions=us&markets=h2h&date=YYYY-MM-DDT05:30:00Z
   Returns an object with { timestamp, previous_timestamp, next_timestamp, data: [...] } */
async function fetchHistoricalDay(yyyy_mm_dd){
  const url = `${API_BASE}/historical/sports/${SPORT_KEY}/odds`;
  const params = {
    apiKey: API_KEY,
    regions: REGIONS,
    markets: MARKET_KEY,
    date: dayProbeUtc(yyyy_mm_dd),
    // NOTE: deliberately not passing bookmakers here (mirror your working request)
    oddsFormat: "american",  // server may still return decimal; we'll normalize
    dateFormat: "iso",
  };
  const resp = await axios.get(url, { params, validateStatus:()=>true });
  if (resp.status !== 200) {
    console.warn(`⚠️ Historical day ${yyyy_mm_dd} resp=${resp.status} msg=${resp.data?.message ?? resp.statusText}`);
    return [];
  }
  const payload = resp.data;
  const list = Array.isArray(payload) ? payload : payload?.data;
  return Array.isArray(list) ? list : [];
}

/* ───────── EVENT SNAPSHOT ─────────
   /v4/historical/sports/{sport}/events/{eventId}/odds?date=... */
async function getEventSnapshot(eventId, isoTs){
  const url = `${API_BASE}/historical/sports/${SPORT_KEY}/events/${eventId}/odds`;
  const params = {
    apiKey: API_KEY,
    regions: REGIONS,
    markets: MARKET_KEY,
    // no bookmakers param — we’ll choose from what’s returned
    oddsFormat: "american",
    dateFormat: "iso",
    date: isoTs
  };
  const resp = await axios.get(url, { params, validateStatus:()=>true });
  if (resp.status !== 200 || !resp.data?.bookmakers?.length) return null;

  // Pick first bookmaker from our priority list that has both sides
  for (const want of BOOKS_PRIO) {
    const bm = resp.data.bookmakers.find(b => (b.key||"").toLowerCase() === want);
    const m  = bm?.markets?.find(x => x.key === MARKET_KEY);
    const os = m?.outcomes || [];
    const h  = os.find(o => o.name === resp.data.home_team);
    const a  = os.find(o => o.name === resp.data.away_team);
    if (h?.price != null && a?.price != null) {
      return {
        book: want,
        ts: resp.data?.data_aggregated_at ?? isoTs,
        home_ml: toAmerican(h.price),
        away_ml: toAmerican(a.price),
        home_team: resp.data.home_team,
        away_team: resp.data.away_team,
      };
    }
  }
  // fallback: take any book with both sides
  for (const bm of resp.data.bookmakers) {
    const m  = bm?.markets?.find(x => x.key === MARKET_KEY);
    const os = m?.outcomes || [];
    const h  = os.find(o => o.name === resp.data.home_team);
    const a  = os.find(o => o.name === resp.data.away_team);
    if (h?.price != null && a?.price != null) {
      return {
        book: (bm.key||"unknown").toLowerCase(),
        ts: resp.data?.data_aggregated_at ?? isoTs,
        home_ml: toAmerican(h.price),
        away_ml: toAmerican(a.price),
        home_team: resp.data.home_team,
        away_team: resp.data.away_team,
      };
    }
  }
  return null;
}

/* open = earliest snapshot we can prove exists (72h window, capped by earliest bet date) */
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
  if (!API_KEY || API_KEY.length < 12) throw new Error("ODDS_API_KEY missing/too short");

  const today = todayCT();

  // lower bound = earliest bet date
  const { data: minRow, error: minErr } = await supabase
    .from("mlb_daily_bets").select("game_date").order("game_date",{ascending:true}).limit(1).single();
  if (minErr) throw minErr;
  if (!minRow?.game_date) { console.log("▶︎ No bets; nothing to do."); return; }

  const earliest = minRow.game_date;
  console.log(`⏱️  Backfill window (CT): ${earliest} → ${today}`);

  // pull all past bets
  const { data: bets, error: betsErr } = await supabase
    .from("mlb_daily_bets")
    .select("matchup_id, team_id, game_date")
    .gte("game_date", earliest)
    .lt("game_date", today);
  if (betsErr) throw betsErr;

  // byDate[date] = Map(mid -> Set(team_ids))
  const byDate = new Map();
  for (const b of (bets||[])) {
    const map = byDate.get(b.game_date) || new Map();
    const set = map.get(b.matchup_id) || new Set();
    set.add(b.team_id);
    map.set(b.matchup_id, set);
    byDate.set(b.game_date, map);
  }
  if (!byDate.size) { console.log("▶︎ Nothing to backfill (no past bets)."); return; }

  // already present CLV rows to skip re-upsert
  const { data: have, error: haveErr } = await supabase
    .from("mlb_line_movements")
    .select("matchup_id, team_id")
    .gte("game_date", earliest)
    .lt("game_date", today);
  if (haveErr) throw haveErr;
  const done = new Set((have||[]).map(r => `${r.matchup_id}::${r.team_id}`));

  // lower bound UTC for open-search (start of earliest CT day)
  const lowerBoundUtc = ctStartUtc(earliest);

  let upserts = 0;

  for (const [date, midMap] of byDate) {
    // 1) fetch snapshot for this date
    const events = await fetchHistoricalDay(date);
    if (!events.length) { console.warn(`⚠️ No historical snapshot for ${date}`); continue; }

    // 2) index events by (home_id, away_id)
    const fwd = new Map(); const rev = new Map();
    for (const ev of events) {
      const h = NAME_TO_ID(ev.home_team), a = NAME_TO_ID(ev.away_team);
      if (!h || !a) continue;
      (fwd.get(`${h}_${a}`) ?? fwd.set(`${h}_${a}`, []).get(`${h}_${a}`)).push(ev);
      (rev.get(`${a}_${h}`) ?? rev.set(`${a}_${h}`, []).get(`${a}_${h}`)).push(ev);
    }
    for (const list of [...fwd.values(), ...rev.values()]) {
      list.sort((x,y) => (x.commence_time||"").localeCompare(y.commence_time||""));
    }

    const usedEventIds = new Set();
    const midsSorted = Array.from(midMap.keys()).sort((a,b)=>a-b);

    // 3) assign each matchup_id → an event deterministically
    for (const mid of midsSorted) {
      const ids = Array.from(midMap.get(mid) || []);
      if (ids.length !== 2) { console.warn(`⚠️ mid=${mid} on ${date} has ${ids.length} teams`); continue; }
      const [t1, t2] = ids;

      let candidate =
        (fwd.get(`${t1}_${t2}`) || []).find(e => !usedEventIds.has(e.id)) ||
        (fwd.get(`${t2}_${t1}`) || []).find(e => !usedEventIds.has(e.id)) ||
        (rev.get(`${t1}_${t2}`) || []).find(e => !usedEventIds.has(e.id)) ||
        (rev.get(`${t2}_${t1}`) || []).find(e => !usedEventIds.has(e.id));

      if (!candidate) {
        console.warn(`⚠️ No event match for mid=${mid} on ${date} (teams ${t1},${t2})`);
        continue;
      }
      usedEventIds.add(candidate.id);

      // 4) open/close snapshots for that event
      const firstPitchUtc = new Date(candidate.commence_time).toISOString();
      const closeSnap = await findCloseForEvent(candidate.id, firstPitchUtc);
      if (!closeSnap) {
        console.warn(`⚠️ No closing snapshot for event ${candidate.id} (mid=${mid})`);
        continue;
      }
      const openSnap  = await findOpenForEvent(candidate.id, firstPitchUtc, lowerBoundUtc);

      // 5) write rows for teams you actually bet
      const teamIds = Array.from(midMap.get(mid) || []);
      const writeOne = async (team_id, isHome) => {
        if (!teamIds.includes(team_id)) return;
        const line_min = isHome ? openSnap?.home_ml : openSnap?.away_ml;
        const time_min = openSnap?.ts;
        const line_max = isHome ? closeSnap.home_ml : closeSnap.away_ml;
        const time_max = closeSnap.ts;

        const payload = {
          matchup_id: mid,
          team_id,
          game_date: date,
          source: `${SRC_PREFIX}:${closeSnap.book}`,
          line_time_min: (time_min ?? time_max),
          line_min:      (line_min ?? line_max),
          line_time_max: time_max,
          line_max:      line_max
        };

        if (done.has(`${mid}::${team_id}`)) return;
        const { error: upErr } = await supabase
          .from("mlb_line_movements")
          .upsert(payload, { onConflict: "matchup_id,team_id,source" });
        if (upErr) console.error("❌ upsert failed", upErr);
        else { upserts++; done.add(`${mid}::${team_id}`); }
      };

      const home_id = NAME_TO_ID(closeSnap.home_team);
      const away_id = NAME_TO_ID(closeSnap.away_team);
      await writeOne(home_id, true);
      await writeOne(away_id, false);
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
