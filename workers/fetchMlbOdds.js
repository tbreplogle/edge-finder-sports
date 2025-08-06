// workers/backfillMlbCLV.js
import axios from "axios";
import { supabase, testConnection } from "./lib/supabaseClient.js";

const SPORT_KEY = "baseball_mlb";
const API_BASE = "https://api.the-odds-api.com/v4";
const API_KEY = process.env.ODDS_API_KEY || "907b67e00fc14e6f4a501355026dba0e";
const REGIONS = "us";
const MARKET_KEY = "h2h";
const BOOKS_PRIO = ["draftkings"];
const SRC_PREFIX = "OddsAPI";

const TEAM_NAME_TO_ID = {
  "SEATTLE MARINERS": 1,
  "CLEVELAND GUARDIANS": 2,
  "PITTSBURGH PIRATES": 3,
  "LOS ANGELES ANGELS": 4,
  "TORONTO BLUE JAYS": 5,
  "MIAMI MARLINS": 6,
  "OAKLAND ATHLETICS": 7,
  "NEW YORK YANKEES": 8,
  "TAMPA BAY RAYS": 9,
  "MINNESOTA TWINS": 10,
  "KANSAS CITY ROYALS": 11,
  "SAN FRANCISCO GIANTS": 12,
  "ARIZONA DIAMONDBACKS": 13,
  "MILWAUKEE BREWERS": 14,
  "CHICAGO WHITE SOX": 15,
  "CHICAGO CUBS": 16,
  "ATLANTA BRAVES": 17,
  "SAN DIEGO PADRES": 18,
  "HOUSTON ASTROS": 19,
  "NEW YORK METS": 20,
  "LOS ANGELES DODGERS": 21,
  "COLORADO ROCKIES": 22,
  "CINCINNATI REDS": 23,
  "WASHINGTON NATIONALS": 24,
  "DETROIT TIGERS": 25,
  "PHILADELPHIA PHILLIES": 26,
  "ST. LOUIS CARDINALS": 27,
  "TEXAS RANGERS": 28,
  "BOSTON RED SOX": 29,
  "BALTIMORE ORIOLES": 30
};

const NAME_TO_ID = (s) => TEAM_NAME_TO_ID[(s || "").trim().toUpperCase()] ?? null;

function toAmerican(price) {
  if (price == null) return null;
  if (typeof price === "number" && (price > 10 || price < -1)) return Math.round(price);
  const dec = Number(price);
  if (!isFinite(dec) || dec <= 1.0) return null;
  return dec >= 2 ? Math.round((dec - 1) * 100) : Math.round(-100 / (dec - 1));
}

const todayCT = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

function ctStartUtc(yyyy_mm_dd) {
  return `${yyyy_mm_dd}T05:00:00Z`;
}

function dayProbeUtc(yyyy_mm_dd) {
  return `${yyyy_mm_dd}T05:30:00Z`;
}

const noMs = (iso) => (iso || "").replace(/\.\d{3}Z$/, "Z");

async function fetchHistoricalDay(yyyy_mm_dd) {
  const url = `${API_BASE}/historical/sports/${SPORT_KEY}/odds`;
  const params = {
    apiKey: API_KEY,
    regions: REGIONS,
    markets: MARKET_KEY,
    date: dayProbeUtc(yyyy_mm_dd)
  };
  const resp = await axios.get(url, { params, validateStatus: () => true });
  if (resp.status !== 200) {
    console.warn(
      `⚠️ Historical day ${yyyy_mm_dd} resp=${resp.status} msg=${resp.data?.message ?? resp.statusText}`
    );
    return [];
  }
  const list = Array.isArray(resp.data) ? resp.data : resp.data?.data;
  return Array.isArray(list) ? list : [];
}

async function getEventSnapshot(eventId, isoTs) {
  const url = `${API_BASE}/historical/sports/${SPORT_KEY}/events/${eventId}/odds`;
  const params = {
    apiKey: API_KEY,
    regions: REGIONS,
    markets: MARKET_KEY,
    date: noMs(isoTs)
  };
  const resp = await axios.get(url, { params, validateStatus: () => true });
  if (resp.status !== 200 || !resp.data?.bookmakers?.length) return null;

  for (const want of BOOKS_PRIO) {
    const bm = resp.data.bookmakers.find((b) => (b.key || "").toLowerCase() === want);
    const m = bm?.markets?.find((x) => x.key === MARKET_KEY);
    const os = m?.outcomes || [];
    const h = os.find((o) => o.name === resp.data.home_team);
    const a = os.find((o) => o.name === resp.data.away_team);
    if (h?.price != null && a?.price != null) {
      return {
        book: want,
        ts: resp.data?.data_aggregated_at ?? isoTs,
        home_ml: toAmerican(h.price),
        away_ml: toAmerican(a.price),
        home_team: resp.data.home_team,
        away_team: resp.data.away_team
      };
    }
  }
  for (const bm of resp.data.bookmakers) {
    const m = bm?.markets?.find((x) => x.key === MARKET_KEY);
    const os = m?.outcomes || [];
    const h = os.find((o) => o.name === resp.data.home_team);
    const a = os.find((o) => o.name === resp.data.away_team);
    if (h?.price != null && a?.price != null) {
      return {
        book: (bm.key || "unknown").toLowerCase(),
        ts: resp.data?.data_aggregated_at ?? isoTs,
        home_ml: toAmerican(h.price),
        away_ml: toAmerican(a.price),
        home_team: resp.data.home_team,
        away_team: resp.data.away_team
      };
    }
  }
  return null;
}

async function findOpenForEvent(eventId, firstPitchUtcIso, lowerBoundUtcIso) {
  const CLOSE = new Date(firstPitchUtcIso).getTime();
  const LOWER = new Date(lowerBoundUtcIso).getTime();
  let start = Math.max(CLOSE - 72 * 3600e3, LOWER);
  const end = CLOSE - 5 * 60e3;

  let foundAt = null;
  for (let t = start; t <= end; t += 6 * 3600e3) {
    const snap = await getEventSnapshot(eventId, noMs(new Date(t).toISOString()));
    if (snap) {
      foundAt = t;
      break;
    }
  }
  if (foundAt == null) return null;

  let lo = start,
    hi = foundAt,
    best = foundAt;
  while (hi - lo > 15 * 60e3) {
    const mid = lo + Math.floor((hi - lo) / 2);
    const snap = await getEventSnapshot(eventId, noMs(new Date(mid).toISOString()));
    if (snap) {
      best = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return await getEventSnapshot(eventId, noMs(new Date(best).toISOString()));
}

async function findCloseForEvent(eventId, firstPitchUtcIso) {
  const closeTs = noMs(new Date(new Date(firstPitchUtcIso).getTime() - 60e3).toISOString());
  return await getEventSnapshot(eventId, closeTs);
}

async function backfillCLV() {
  if (!(await testConnection())) throw new Error("DB connection failed");
  if (!API_KEY || API_KEY.length < 12) throw new Error("ODDS_API_KEY missing/invalid");

  const today = todayCT();

  const { data: minRow, error: minErr } = await supabase
    .from("mlb_daily_bets")
    .select("game_date")
    .order("game_date", { ascending: true })
    .limit(1)
    .single();
  if (minErr) throw minErr;
  if (!minRow?.game_date) {
    console.log("▶︎ No bets; nothing to do.");
    return;
  }

  const earliest = minRow.game_date;
  console.log(`⏱️  Backfill window (CT): ${earliest} → ${today}`);

  const { data: bets, error: betsErr } = await supabase
    .from("mlb_daily_bets")
    .select("matchup_id, team_id, game_date")
    .gte("game_date", earliest)
    .lt("game_date", today);
  if (betsErr) throw betsErr;

  const byDate = new Map();
  for (const b of bets || []) {
    const map = byDate.get(b.game_date) || new Map();
    const set = map.get(b.matchup_id) || new Set();
    set.add(b.team_id);
    map.set(b.matchup_id, set);
    byDate.set(b.game_date, map);
  }
  if (!byDate.size) {
    console.log("▶︎ Nothing to backfill (no past bets).");
    return;
  }

  const { data: have, error: haveErr } = await supabase
    .from("mlb_line_movements")
    .select("matchup_id, team_id")
    .gte("game_date", earliest)
    .lt("game_date", today);
  if (haveErr) throw haveErr;
  const done = new Set((have || []).map((r) => `${r.matchup_id}::${r.team_id}`));

  const lowerBoundUtc = ctStartUtc(earliest);
  let upserts = 0;

  for (const [date, midMap] of byDate) {
    const events = await fetchHistoricalDay(date);
    if (!events.length) {
      console.warn(`⚠️ No historical snapshot for ${date}`);
      continue;
    }

    const fwd = new Map();
    const rev = new Map();
    for (const ev of events) {
      const h = NAME_TO_ID(ev.home_team);
      const a = NAME_TO_ID(ev.away_team);
      if (!h || !a) continue;
      const k1 = `${h}_${a}`;
      const k2 = `${a}_${h}`;
      (fwd.get(k1) ?? fwd.set(k1, []).get(k1)).push(ev);
      (rev.get(k2) ?? rev.set(k2, []).get(k2)).push(ev);
    }
    for (const list of [...fwd.values(), ...rev.values()]) {
      list.sort((x, y) => (x.commence_time || "").localeCompare(y.commence_time || ""));
    }

    const usedEventIds = new Set();
    const midsSorted = Array.from(midMap.keys()).sort((a, b) => a - b);

    for (const mid of midsSorted) {
      const ids = Array.from(midMap.get(mid) || []);
      if (ids.length !== 2) {
        console.warn(`⚠️ mid=${mid} on ${date} has ${ids.length} teams`);
        continue;
      }
      const [t1, t2] = ids;

      let candidate =
        (fwd.get(`${t1}_${t2}`) || []).find((e) => !usedEventIds.has(e.id)) ||
        (fwd.get(`${t2}_${t1}`) || []).find((e) => !usedEventIds.has(e.id)) ||
        (rev.get(`${t1}_${t2}`) || []).find((e) => !usedEventIds.has(e.id)) ||
        (rev.get(`${t2}_${t1}`) || []).find((e) => !usedEventIds.has(e.id));

      if (!candidate) {
        console.warn(`⚠️ No event match for mid=${mid} on ${date} (teams ${t1},${t2})`);
        continue;
      }
      usedEventIds.add(candidate.id);

      const firstPitchUtc = new Date(candidate.commence_time).toISOString();
      const closeSnap = await findCloseForEvent(candidate.id, firstPitchUtc);
      if (!closeSnap) {
        console.warn(`⚠️ No closing snapshot for event ${candidate.id} (mid=${mid})`);
        continue;
      }
      const openSnap = await findOpenForEvent(candidate.id, firstPitchUtc, lowerBoundUtc);

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
          line_time_min: time_min ?? time_max,
          line_min: line_min ?? line_max,
          line_time_max: time_max,
          line_max: line_max
        };

        if (done.has(`${mid}::${team_id}`)) return;
        const { error: upErr } = await supabase
          .from("mlb_line_movements")
          .upsert(payload, { onConflict: "matchup_id,team_id,source" });
        if (upErr) console.error("❌ upsert failed", upErr);
        else {
          upserts++;
          done.add(`${mid}::${team_id}`);
        }
      };

      const home_id = NAME_TO_ID(closeSnap.home_team);
      const away_id = NAME_TO_ID(closeSnap.away_team);
      await writeOne(home_id, true);
      await writeOne(away_id, false);
    }
  }

  console.log(`✅ Backfill complete. Upserts: ${upserts}`);
}

if (import.meta.url.endsWith("backfillMlbCLV.js")) {
  console.log("▶︎ Backfilling CLV (past games)");
  backfillCLV()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
