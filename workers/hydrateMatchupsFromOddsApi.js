/* eslint-disable no-console */
import axios from "axios";
import { supabase, testConnection } from "./lib/supabaseClient.js";

/* ─── config ─── */
const SPORT_KEY  = "baseball_mlb";
const API_BASE   = "https://api.the-odds-api.com/v4";
const API_KEY    = process.env.ODDS_API_KEY || "REPLACE_ME";
const MARKET_KEY = "h2h";
const BOOKS_PRIO = ["pinnacle","draftkings","fanduel","betmgm","caesars"];

/* Odds API team names → your team_id */
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

/* time helpers */
const todayCT = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" }); // YYYY-MM-DD
function endOfDayCtToUtcIso(yyyy_mm_dd) {
  // approx: CT + 5h during MLB (CDT). Good enough for daily snapshot bound.
  const dt = new Date(`${yyyy_mm_dd}T23:59:59`);
  return new Date(dt.getTime() + 5 * 3600e3).toISOString();
}
function toCtIso(utcIso) {
  const d = new Date(utcIso);
  const ct = new Date(d.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  return new Date(ct.getTime() - ct.getTimezoneOffset()*60000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/* pull one daily historical snapshot (≤ end-of-day) */
async function fetchHistoricalDay(yyyy_mm_dd) {
  const url = `${API_BASE}/historical/sports/${SPORT_KEY}/odds`;
  const params = {
    apiKey: API_KEY, date: endOfDayCtToUtcIso(yyyy_mm_dd),
    markets: MARKET_KEY, bookmakers: BOOKS_PRIO.slice(0,3).join(","),
    oddsFormat: "american", dateFormat: "iso",
  };
  const resp = await axios.get(url, { params, validateStatus: () => true });
  if (resp.status !== 200 || !Array.isArray(resp.data)) return [];
  return resp.data; // [{ id, home_team, away_team, commence_time, ... }]
}

async function hydrate() {
  if (!(await testConnection())) throw new Error("DB connection failed");

  // bounds
  const { data: minRow, error: minErr } = await supabase
    .from("mlb_daily_bets").select("game_date").order("game_date", { ascending: true }).limit(1).single();
  if (minErr) throw minErr;
  if (!minRow?.game_date) { console.log("No bets; nothing to do."); return; }
  const earliest = minRow.game_date;
  const today = todayCT();
  console.log(`⏱️  Hydrate window: ${earliest} → ${today}`);

  // 1) gather per-matchup info from bets (past only)
  const { data: bets, error: betErr } = await supabase
    .from("mlb_daily_bets")
    .select("matchup_id, team_id, game_date")
    .gte("game_date", earliest)
    .lt("game_date", today);
  if (betErr) throw betErr;

  const byMatch = new Map();
  for (const b of (bets||[])) {
    const entry = byMatch.get(b.matchup_id) || { date: b.game_date, teams: new Set() };
    entry.date = entry.date || b.game_date;
    entry.teams.add(b.team_id);
    byMatch.set(b.matchup_id, entry);
  }

  // 2) fetch existing matchups for those ids (don’t rely on game_date filter)
  const mids = Array.from(byMatch.keys());
  const { data: existing, error: exErr } = await supabase
    .from("mlb_matchups")
    .select("matchup_id, home_team_id, away_team_id, game_id, game_time_ct, game_date")
    .in("matchup_id", mids);
  if (exErr) throw exErr;
  const byMid = new Map((existing||[]).map(r => [r.matchup_id, r]));

  // 3) build date → list of matchup_ids needing hydration (missing row or missing fields)
  const needByDate = new Map();
  for (const [mid, info] of byMatch) {
    const row = byMid.get(mid);
    const missing = !row || !row.game_id || !row.game_time_ct;
    if (!missing) continue;
    const list = needByDate.get(info.date) || [];
    list.push(mid);
    needByDate.set(info.date, list);
  }
  if (!needByDate.size) {
    console.log("No missing rows/fields for these matchup_ids.");
    return;
  }

  let updated = 0, inserted = 0, unmatched = 0;

  // 4) per date: fetch snapshot once, index by (home_id, away_id)
  for (const [date, midsForDay] of needByDate) {
    const events = await fetchHistoricalDay(date);
    if (!events.length) {
      console.warn(`⚠️ No historical snapshot for ${date}`);
      unmatched += midsForDay.length;
      continue;
    }

    const idx = new Map(); // "home_away" → [events sorted by time]
    for (const ev of events) {
      const h = NAME_TO_ID(ev.home_team), a = NAME_TO_ID(ev.away_team);
      if (!h || !a) continue;
      const key = `${h}_${a}`;
      (idx.get(key) ?? idx.set(key, []).get(key)).push(ev);
    }
    for (const list of idx.values()) {
      list.sort((x,y) => (x.commence_time||"").localeCompare(y.commence_time||""));
    }

    for (const mid of midsForDay) {
      const info = byMatch.get(mid);
      const [t1, t2] = Array.from(info.teams);
      if (!t1 || !t2) { unmatched++; continue; }

      // Try both home/away orders
      let ev = (idx.get(`${t1}_${t2}`) || [])[0] || (idx.get(`${t2}_${t1}`) || [])[0];
      if (!ev) { unmatched++; continue; }

      const ctIso = toCtIso(ev.commence_time);
      const exists = byMid.get(mid);

      if (!exists) {
        // insert new row
        const patch = {
          matchup_id: mid,
          home_team_id: NAME_TO_ID(ev.home_team),
          away_team_id: NAME_TO_ID(ev.away_team),
          game_date: date,
          game_time_ct: ctIso,
          game_id: ev.id
        };
        const { error: insErr } = await supabase.from("mlb_matchups").insert(patch);
        if (insErr) { console.error("❌ insert failed", insErr); continue; }
        inserted++; byMid.set(mid, patch);
      } else {
        const patch = {};
        if (!exists.game_id)      patch.game_id = ev.id;
        if (!exists.game_time_ct) patch.game_time_ct = ctIso;
        if (!exists.home_team_id) patch.home_team_id = NAME_TO_ID(ev.home_team);
        if (!exists.away_team_id) patch.away_team_id = NAME_TO_ID(ev.away_team);
        if (!exists.game_date)    patch.game_date = date;

        if (Object.keys(patch).length) {
          const { error: upErr } = await supabase
            .from("mlb_matchups").update(patch).eq("matchup_id", mid);
          if (upErr) { console.error("❌ update failed", upErr); continue; }
          updated++;
        }
      }
    }
  }

  console.log(`✅ Hydration done. inserted=${inserted}, updated=${updated}, unmatched=${unmatched}`);
}

/* CLI */
if (import.meta.url.endsWith("hydrateMatchupsFromOddsApi.js")) {
  hydrate()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
