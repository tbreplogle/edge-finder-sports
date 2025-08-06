/* eslint-disable no-console */
import axios from "axios";
import { supabase, testConnection } from "./lib/supabaseClient.js";

/* ─── config ─── */
const SPORT_KEY  = "baseball_mlb";
const API_BASE   = "https://api.the-odds-api.com/v4";
const API_KEY    = process.env.ODDS_API_KEY || "REPLACE_ME";
const MARKET_KEY = "h2h";
const BOOKS_PRIO = ["pinnacle","draftkings","fanduel","betmgm","caesars"]; // low → credits

/* Odds API team names → your team_id (same mapping you used before) */
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
const NAME_TO_ID = (s) => TEAM_NAME_TO_ID[(s || "").trim().toUpperCase()] ?? null;

/* time helpers */
const todayCT = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" }); // YYYY-MM-DD

function endOfDayCtToUtcIso(yyyy_mm_dd) {
  // 23:59:59 CT → UTC ISO (CDT≈UTC-5; CST≈UTC-6). Approx +5h is fine for daily bound in MLB season.
  const dt = new Date(`${yyyy_mm_dd}T23:59:59`);
  return new Date(dt.getTime() + 5 * 3600e3).toISOString();
}
function toCtIso(utcIso) {
  const d = new Date(utcIso);
  // format to ISO in CT with local wall clock (store as string)
  const parts = new Date(d.toLocaleString("en-US", { timeZone: "America/Chicago" }))
    .toISOString()
    .split(".")[0] + "Z";
  return parts;
}
function ctDateFromUtcIso(utcIso) {
  return new Date(utcIso).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

/* call historical snapshot at end-of-day; returns list of events */
async function fetchHistoricalDay(yyyy_mm_dd) {
  const url = `${API_BASE}/historical/sports/${SPORT_KEY}/odds`;
  const params = {
    apiKey: API_KEY,
    date: endOfDayCtToUtcIso(yyyy_mm_dd),  // snapshot <= end-of-day
    markets: MARKET_KEY,
    bookmakers: BOOKS_PRIO.slice(0, 3).join(","), // keep it cheap
    oddsFormat: "american",
    dateFormat: "iso",
  };
  const resp = await axios.get(url, { params, validateStatus: () => true });
  if (resp.status !== 200 || !Array.isArray(resp.data)) return [];
  return resp.data; // [{ id, home_team, away_team, commence_time, bookmakers: [...] }, ...]
}

/* hydrate missing game_id or game_time_ct for past matchups */
async function hydrate() {
  if (!(await testConnection())) throw new Error("DB connection failed");

  // a) earliest date in bets (lower bound)
  const { data: minRow, error: minErr } = await supabase
    .from("mlb_daily_bets")
    .select("game_date")
    .order("game_date", { ascending: true })
    .limit(1)
    .single();
  if (minErr) throw minErr;
  if (!minRow?.game_date) {
    console.log("No mlb_daily_bets rows; nothing to do.");
    return;
  }
  const earliest = minRow.game_date;
  const today = todayCT();

  // b) pull missing rows from mlb_matchups within window
  const { data: missing, error: missErr } = await supabase
    .from("mlb_matchups")
    .select("matchup_id, home_team_id, away_team_id, game_date, game_time_ct, game_id")
    .gte("game_date", earliest)
    .lt("game_date", today)
    .or("game_id.is.null,game_time_ct.is.null");
  if (missErr) throw missErr;
  if (!missing?.length) {
    console.log("No missing game_id/game_time_ct; hydrate not needed.");
    return;
  }

  // c) group by date
  const byDate = missing.reduce((m, r) => {
    (m[r.game_date] ||= []).push(r);
    return m;
  }, {});

  let updated = 0;
  for (const day of Object.keys(byDate).sort()) {
    // 1) fetch snapshot for this date
    const events = await fetchHistoricalDay(day);
    if (!events.length) {
      console.warn(`⚠️ No historical snapshot for ${day}`);
      continue;
    }

    // 2) index events by (home_id, away_id, ct_date)
    const index = new Map(); // key → array of events sorted by commence_time
    for (const ev of events) {
      const hId = NAME_TO_ID(ev.home_team);
      const aId = NAME_TO_ID(ev.away_team);
      if (!hId || !aId) continue;
      const ctDate = ctDateFromUtcIso(ev.commence_time);
      const key = `${hId}_${aId}_${ctDate}`;
      (index.get(key) ?? index.set(key, []).get(key)).push(ev);
    }
    for (const list of index.values()) {
      list.sort((x, y) => (x.commence_time || "").localeCompare(y.commence_time || ""));
    }

    // 3) within this date, group our missing rows by the same key and assign events
    const rows = byDate[day];
    const groups = new Map();
    for (const r of rows) {
      const key = `${r.home_team_id}_${r.away_team_id}_${r.game_date}`;
      (groups.get(key) ?? groups.set(key, []).get(key)).push(r);
    }
    for (const [key, groupRows] of groups) {
      const evs = index.get(key) || [];
      if (!evs.length) {
        // try reversed home/away in case your matchups are flipped
        const [h, a, d] = key.split("_");
        const flip = `${a}_${h}_${d}`;
        if (index.has(flip)) {
          // swap meaning: if your row is home/away but snapshot is away/home we still map
          const evsFlip = index.get(flip);
          await assignAndUpdate(groupRows, evsFlip, true);
        } else {
          console.warn(`⚠️ No event match for key ${key} on ${day}`);
        }
        continue;
      }
      await assignAndUpdate(groupRows, evs, false);
    }
  }

  console.log(`✅ Hydration complete. Rows updated: ${updated}`);

  async function assignAndUpdate(groupRows, eventList, flipped) {
    // deterministic pairing: earliest event → lowest matchup_id, next → next, etc.
    const sortedRows = groupRows.slice().sort((a, b) => (a.matchup_id - b.matchup_id));
    const toAssign = Math.min(sortedRows.length, eventList.length);
    for (let i = 0; i < toAssign; i++) {
      const row = sortedRows[i];
      const ev  = eventList[i];
      const ctIso = toCtIso(ev.commence_time);

      const patch = {};
      if (!row.game_id)      patch.game_id = ev.id;
      if (!row.game_time_ct) patch.game_time_ct = ctIso;

      if (Object.keys(patch).length) {
        const { error: upErr } = await supabase
          .from("mlb_matchups")
          .update(patch)
          .eq("matchup_id", row.matchup_id);
        if (upErr) console.error("❌ update failed", upErr);
        else updated++;
      }
    }
  }
}

/* CLI */
if (import.meta.url.endsWith("hydrateMatchupsFromOddsApi.js")) {
  hydrate()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
