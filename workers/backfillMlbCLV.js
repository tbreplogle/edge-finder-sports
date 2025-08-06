/* eslint-disable no-console */
import axios from "axios";
import { supabase, testConnection } from "./lib/supabaseClient.js";

/* ───────────────────────────────────────────────────────────
   CONFIG
   - Pick your CLV book priority. We'll take the first book
     that has BOTH home and away moneylines at each snapshot.
   ─────────────────────────────────────────────────────────── */
const SPORT_KEY   = "baseball_mlb";
const API_BASE    = "https://api.the-odds-api.com/v4";
const API_KEY     = process.env.ODDS_API_KEY || "REPLACE_ME"; // <-- set in GH secrets
const REGIONS     = "us"; // ignored if bookmakers is set
const BOOKS_PRIO  = ["pinnacle","draftkings","fanduel","betmgm","caesars"]; // edit if you want
const MARKET_KEY  = "h2h"; // moneyline
const SRC_PREFIX  = "OddsAPI"; // stored in mlb_line_movements.source like "OddsAPI:pinnacle"

/* ───────────────────────────────────────────────────────────
   TIME HELPERS (Central → UTC ISO)
   ─────────────────────────────────────────────────────────── */
const todayCT = () =>
  new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }).split(",")[0];

function ctISOToUTCISO(ctIso) {
  if (!ctIso) return null;
  // Date parses ISO as UTC; we need to convert from CT to UTC (+5 or +6).
  // We’ll reconstruct using the CT wall clock then shift by the CT offset.
  const ct = new Date(ctIso);
  // Get CT offset *at that instant* by asking for the same fields in CT
  const dt = new Date(ct.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  // Difference between “interpreted as CT” and “UTC” gives the offset
  const utcMillis = ct.getTime() + (ct.getTime() - dt.getTime());
  return new Date(utcMillis).toISOString();
}

/* Round trip to Odds API for a single event + timestamp (ISO)
   Returns {book, ts, home_ml, away_ml} or null */
async function getSnapshotForEvent(eventId, isoTs) {
  const url = `${API_BASE}/historical/sports/${SPORT_KEY}/events/${eventId}/odds`;
  const params = {
    apiKey: API_KEY,
    regions: REGIONS,
    markets: MARKET_KEY,
    bookmakers: BOOKS_PRIO.join(","),
    oddsFormat: "american",
    dateFormat: "iso",
    date: isoTs,
  };
  const resp = await axios.get(url, { params, validateStatus: () => true });
  if (resp.status !== 200 || !resp.data?.bookmakers?.length) return null;

  // choose first bookmaker in BOOKS_PRIO that has both sides
  for (const want of BOOKS_PRIO) {
    const bm = resp.data.bookmakers.find(b => (b.key || "").toLowerCase() === want);
    const market = bm?.markets?.find(m => m.key === MARKET_KEY);
    const outs   = market?.outcomes || [];
    if (!outs.length) continue;

    // Try to infer home/away by name match against resp.data.home_team/away_team
    const homeName = resp.data.home_team;
    const awayName = resp.data.away_team;
    const home = outs.find(o => o.name === homeName);
    const away = outs.find(o => o.name === awayName);
    if (home?.price != null && away?.price != null) {
      return {
        book: want,
        ts: resp.data?.data_aggregated_at ?? isoTs,
        home_ml: home.price,
        away_ml: away.price,
      };
    }
  }
  return null;
}

/* Find "open" snapshot:
   - search window: [closeTs - 72h, closeTs - 5m]
   - coarse step 6h forward until we first see odds
   - then binary refine to ~15m resolution to pick earliest
*/
async function findOpenSnapshot(eventId, closeTsIso) {
  const CLOSE = new Date(closeTsIso).getTime();
  let start = CLOSE - 72 * 3600e3;
  const end = CLOSE - 5 * 60e3;

  let foundAt = null;

  // Coarse forward scan (6h steps)
  for (let t = start; t <= end; t += 6 * 3600e3) {
    const snap = await getSnapshotForEvent(eventId, new Date(t).toISOString());
    if (snap) { foundAt = t; break; }
  }
  if (foundAt == null) return null;

  // Binary refine between [start, foundAt]
  let lo = start, hi = foundAt, best = foundAt;
  while (hi - lo > 15 * 60e3) {
    const mid = lo + Math.floor((hi - lo) / 2);
    const snap = await getSnapshotForEvent(eventId, new Date(mid).toISOString());
    if (snap) { best = mid; hi = mid - 1; } else { lo = mid + 1; }
  }
  // Final snapshot at 'best'
  return await getSnapshotForEvent(eventId, new Date(best).toISOString());
}

/* Closing snapshot = snapshot <= first pitch (we use game_time_ct - 60s) */
async function findCloseSnapshot(eventId, gameTimeCtIso) {
  const closeTs = new Date(new Date(gameTimeCtIso).getTime() - 60e3).toISOString();
  return await getSnapshotForEvent(eventId, closeTs);
}

/* ───────────────────────────────────────────────────────────
   MAIN
   ─────────────────────────────────────────────────────────── */
async function backfillCLV() {
  if (!(await testConnection())) throw new Error("DB connection failed");

  const today = todayCT(); // 'MM/DD/YYYY' in CT; we’ll convert for SQL compare
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" }); // 'YYYY-MM-DD'

  // 1) Pull all bets BEFORE today & any existing CLV rows to skip
  const [{ data: bets, error: e1 }, { data: haveRows, error: e2 }] = await Promise.all([
    supabase.from("mlb_daily_bets")
      .select("matchup_id, team_id, team_name, game_date")
      .lt("game_date", todayIso),
    supabase.from("mlb_line_movements")
      .select("matchup_id, team_id")
      .lt("game_date", todayIso),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const already = new Set((haveRows || []).map(r => `${r.matchup_id}::${r.team_id}`));
  const need = (bets || []).filter(b => !already.has(`${b.matchup_id}::${b.team_id}`));
  if (!need.length) {
    console.log("▶︎ Nothing to backfill (all past bets already have CLV).");
    return;
  }

  // 2) Join to mlb_matchups to get event id (Odds API game_id) & start time
  const mids = Array.from(new Set(need.map(b => b.matchup_id)));
  const { data: matchups, error: e3 } = await supabase
    .from("mlb_matchups")
    .select("matchup_id, game_id, home_team_id, away_team_id, game_time_ct")
    .in("matchup_id", mids);
  if (e3) throw e3;

  const byMid = new Map((matchups || []).map(m => [m.matchup_id, m]));

  // 3) Group bets by matchup_id; fetch snapshots once per event
  const byMatch = need.reduce((m, b) => {
    (m[b.matchup_id] ||= []).push(b);
    return m;
  }, {});

  let upsertCount = 0;
  for (const mid of Object.keys(byMatch)) {
    const m = byMid.get(mid);
    if (!m?.game_id || !m?.game_time_ct) {
      console.warn(`⚠️ Missing game_id or game_time_ct for matchup ${mid}; skipping.`);
      continue;
    }

    const closeSnap = await findCloseSnapshot(m.game_id, ctISOToUTCISO(m.game_time_ct));
    if (!closeSnap) {
      console.warn(`⚠️ No closing snapshot for event ${m.game_id} (mid=${mid}); skipping.`);
      continue;
    }

    const openSnap = await findOpenSnapshot(m.game_id, ctISOToUTCISO(m.game_time_ct));
    if (!openSnap) {
      console.warn(`⚠️ No opening snapshot found for event ${m.game_id} (mid=${mid}); using closing only.`);
    }

    // Upsert each team’s row
    for (const b of byMatch[mid]) {
      const isHome = b.team_id === m.home_team_id;
      const isAway = b.team_id === m.away_team_id;

      if (!isHome && !isAway) {
        console.warn(`⚠️ team_id ${b.team_id} not home/away for mid=${mid}; skipping.`);
        continue;
      }

      const line_min = isHome ? openSnap?.home_ml : openSnap?.away_ml;
      const time_min = openSnap?.ts;
      const line_max = isHome ? closeSnap.home_ml : closeSnap.away_ml;
      const time_max = closeSnap.ts;

      // If we couldn't get open, require close only (respect NOT NULL)
      if (time_max == null || line_max == null) {
        console.warn(`⚠️ Incomplete closing data for team_id=${b.team_id}, mid=${mid}; skipping.`);
        continue;
      }

      const payload = {
        matchup_id: mid,
        team_id: b.team_id,
        game_date: b.game_date,
        source: `${SRC_PREFIX}:${closeSnap.book}`, // book used for both snapshots
        line_time_min: time_min ?? time_max,      // fallback to close time if open missing
        line_min: line_min ?? line_max,           // fallback to close line if open missing
        line_time_max: time_max,
        line_max: line_max
      };

      const { error: upErr } = await supabase
        .from("mlb_line_movements")
        .upsert(payload, { onConflict: "matchup_id,team_id,source" });

      if (upErr) console.error("❌ upsert failed", upErr);
      else upsertCount++;
    }
  }

  console.log(`✅ Backfill complete. Upserts: ${upsertCount}`);
}

/* CLI */
if (import.meta.url.endsWith("backfillMlbCLV.js")) {
  backfillCLV()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
