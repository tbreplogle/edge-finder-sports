/* eslint-disable no-console */
import axios from "axios";
import { supabase, testConnection } from "./lib/supabaseClient.js";

/* ───────────────────────────────────────────────────────────
   CONFIG
   ─────────────────────────────────────────────────────────── */
const SPORT_KEY   = "baseball_mlb";
const API_BASE    = "https://api.the-odds-api.com/v4";
const API_KEY     = process.env.ODDS_API_KEY || "907b67e00fc14e6f4a501355026dba0e"; // set in GH secrets
const REGIONS     = "us";
const BOOKS_PRIO  = ["pinnacle", "draftkings", "fanduel", "betmgm", "caesars"];
const MARKET_KEY  = "h2h";
const SRC_PREFIX  = "OddsAPI";

/* ───────────────────────────────────────────────────────────
   TIME HELPERS
   ─────────────────────────────────────────────────────────── */
const todayIsoCT = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" }); // YYYY-MM-DD in CT

function ctStartOfDayUtcIso(ctDateYYYYMMDD) {
  // Create 00:00:00 CT and convert to UTC ISO
  const [y, m, d] = ctDateYYYYMMDD.split("-").map(Number);
  const ct = new Date(`${ctDateYYYYMMDD}T00:00:00-06:00`); // -06 works year-round; small DST offset error is fine for lower bound
  return new Date(ct.getTime() + 6 * 3600e3).toISOString(); // add 6h to get UTC
}

// Convert a CT ISO to UTC ISO (approx; good enough for snapshot bound)
function ctISOToUTCISO(ctIso) {
  if (!ctIso) return null;
  // Assume the stored ctIso is a proper ISO in local CT clock.
  // We shift by +5h (summer) / +6h (winter). Approximate with +5h; MLB season is in CDT.
  return new Date(new Date(ctIso).getTime() + 5 * 3600e3).toISOString();
}

/* ───────────────────────────────────────────────────────────
   ODDS API SNAPSHOTS
   ─────────────────────────────────────────────────────────── */
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

  for (const want of BOOKS_PRIO) {
    const bm = resp.data.bookmakers.find(b => (b.key || "").toLowerCase() === want);
    const market = bm?.markets?.find(m => m.key === MARKET_KEY);
    const outs   = market?.outcomes || [];
    const home   = outs.find(o => o.name === resp.data.home_team);
    const away   = outs.find(o => o.name === resp.data.away_team);
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

/* Find earliest available odds (“open”) within [lowerBoundUtc, closeTs-5m] */
async function findOpenSnapshot(eventId, closeTsIso, lowerBoundUtcIso) {
  const CLOSE = new Date(closeTsIso).getTime();
  const LOWER = new Date(lowerBoundUtcIso).getTime();
  let start = Math.max(CLOSE - 72 * 3600e3, LOWER); // cap by global earliest date
  const end = CLOSE - 5 * 60e3;

  let foundAt = null;
  for (let t = start; t <= end; t += 6 * 3600e3) {
    const snap = await getSnapshotForEvent(eventId, new Date(t).toISOString());
    if (snap) { foundAt = t; break; }
  }
  if (foundAt == null) return null;

  // refine to ~15m
  let lo = start, hi = foundAt, best = foundAt;
  while (hi - lo > 15 * 60e3) {
    const mid = lo + Math.floor((hi - lo) / 2);
    const snap = await getSnapshotForEvent(eventId, new Date(mid).toISOString());
    if (snap) { best = mid; hi = mid - 1; } else { lo = mid + 1; }
  }
  return await getSnapshotForEvent(eventId, new Date(best).toISOString());
}

/* Closing snapshot = snapshot <= (first pitch - 60s) */
async function findCloseSnapshot(eventId, gameTimeCtIso) {
  const closeTs = new Date(new Date(gameTimeCtIso).getTime() - 60e3).toISOString();
  return await getSnapshotForEvent(eventId, closeTs);
}

/* ───────────────────────────────────────────────────────────
   MAIN
   ─────────────────────────────────────────────────────────── */
async function backfillCLV() {
  if (!(await testConnection())) throw new Error("DB connection failed");

  const today = todayIsoCT(); // YYYY-MM-DD (CT)

  // 0) Find the earliest date present in mlb_daily_bets
  const { data: minRow, error: minErr } = await supabase
    .from("mlb_daily_bets")
    .select("game_date")
    .order("game_date", { ascending: true })
    .limit(1)
    .single();

  if (minErr) throw minErr;
  if (!minRow?.game_date) {
    console.log("▶︎ No rows in mlb_daily_bets; nothing to do.");
    return;
  }

  const earliest = minRow.game_date; // YYYY-MM-DD
  const lowerBoundUtcIso = ctStartOfDayUtcIso(earliest);

  console.log(`⏱️  Backfill window: ${earliest} → ${today} (CT)`);

  // 1) Pull bets BEFORE today AND on/after earliest
  const [{ data: bets, error: e1 }, { data: haveRows, error: e2 }] = await Promise.all([
    supabase.from("mlb_daily_bets")
      .select("matchup_id, team_id, team_name, game_date")
      .gte("game_date", earliest)
      .lt("game_date", today),
    supabase.from("mlb_line_movements")
      .select("matchup_id, team_id")
      .gte("game_date", earliest)
      .lt("game_date", today),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const already = new Set((haveRows || []).map(r => `${r.matchup_id}::${r.team_id}`));
  const need = (bets || []).filter(b => !already.has(`${b.matchup_id}::${b.team_id}`));
  if (!need.length) {
    console.log("▶︎ Nothing to backfill (all past bets already have CLV).");
    return;
  }

  // 2) Join matchups to get Odds API event id and first-pitch time
  const mids = Array.from(new Set(need.map(b => b.matchup_id)));
  const { data: matchups, error: e3 } = await supabase
    .from("mlb_matchups")
    .select("matchup_id, game_id, home_team_id, away_team_id, game_time_ct")
    .in("matchup_id", mids);
  if (e3) throw e3;
  const byMid = new Map((matchups || []).map(m => [m.matchup_id, m]));

  // 3) Group and process
  const byMatch = need.reduce((m, b) => ((m[b.matchup_id] ||= []).push(b), m), {});
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

    const openSnap = await findOpenSnapshot(
      m.game_id,
      ctISOToUTCISO(m.game_time_ct),
      lowerBoundUtcIso
    );
    if (!openSnap) {
      console.warn(`⚠️ No opening snapshot found for event ${m.game_id} (mid=${mid}); using closing only.`);
    }

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

      if (time_max == null || line_max == null) {
        console.warn(`⚠️ Incomplete closing data for team_id=${b.team_id}, mid=${mid}; skipping.`);
        continue;
      }

      const payload = {
        matchup_id: mid,
        team_id: b.team_id,
        game_date: b.game_date,
        source: `${SRC_PREFIX}:${closeSnap.book}`,
        line_time_min: time_min ?? time_max,
        line_min: line_min ?? line_max,
        line_time_max: time_max,
        line_max: line_max,
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
