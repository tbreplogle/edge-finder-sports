import axios from "axios";
import { supabase, testConnection } from "./lib/supabaseClient.js";

const API_KEY = process.env.ODDS_API_KEY || "907b67e00fc14e6f4a501355026dba0e";
const API_BASE = "https://api.the-odds-api.com/v4";
const SPORT_KEY = "baseball_mlb";
const REGIONS = "us";
const MARKET = "h2h";
const BOOKMAKERS = [
  "draftkings",
  "fanduel",
  "williamhill_us",
  "betmgm",
  "betrivers",
  "bovada",
  "betonlineag",
  "lowvig",
  "mybookieag",
  "fanatics"
];

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
  "CHICAGO CUBS": 16, "CUBS": 16, "CHI CUBS": 16, "CHC": 16,
  "ATLANTA BRAVES": 17, "ATLANTA": 17, "BRAVES": 17, "ATL": 17,
  "SAN DIEGO PADRES": 18, "SAN DIEGO": 18, "PADRES": 18, "SD": 18, "SDP": 18,
  "HOUSTON ASTROS": 19, "HOUSTON": 19, "ASTROS": 19, "HOU": 19,
  "NEW YORK METS": 20, "NY METS": 20, "METS": 20, "NYM": 20,
  "LOS ANGELES DODGERS": 21, "LA DODGERS": 21, "DODGERS": 21, "LAD": 21, "LA": 21,
  "COLORADO ROCKIES": 22, "COLORADO": 22, "ROCKIES": 22, "COL": 22,
  "CINCINNATI REDS": 23, "CINCINNATI": 23, "REDS": 23, "CIN": 23,
  "WASHINGTON NATIONALS": 24, "WASHINGTON": 24, "NATIONALS": 24, "WAS": 24, "WSH": 24,
  "DETROIT TIGERS": 25, "DETROIT": 25, "TIGERS": 25, "DET": 25,
  "PHILADELPHIA PHILLIES": 26, "PHILADELPHIA": 26, "PHILLIES": 26, "PHI": 26,
  "ST. LOUIS CARDINALS": 27, "ST LOUIS CARDINALS": 27, "ST LOUIS": 27, "CARDINALS": 27, "STL": 27,
  "TEXAS RANGERS": 28, "TEXAS": 28, "RANGERS": 28, "TEX": 28,
  "BOSTON RED SOX": 29, "BOSTON": 29, "RED SOX": 29, "BOS": 29,
  "BALTIMORE ORIOLES": 30, "BALTIMORE": 30, "ORIOLES": 30, "BAL": 30
};

const toCT = (d) => {
  const t = new Date(d);
  return new Date(t.getTime() - 5 * 60 * 60 * 1000);
};
const toUTC = (d) => {
  const t = new Date(d);
  return new Date(t.getTime() + 5 * 60 * 60 * 1000);
};
const ymd = (d) => d.toISOString().slice(0, 10);

async function getEarliestBetDate() {
  const { data, error } = await supabase
    .from("mlb_daily_bets")
    .select("game_date")
    .order("game_date", { ascending: true })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.game_date || ymd(new Date());
}

async function getTargetDates() {
  const start = await getEarliestBetDate();
  const todayCT = ymd(toCT(new Date()));
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(todayCT + "T00:00:00Z");
  const out = [];
  for (let t = s; t < e; t = new Date(t.getTime() + 24 * 60 * 60 * 1000)) {
    out.push(ymd(t));
  }
  return out;
}

function probeTimestampsForCTDay(ctYmd) {
  const anchors = ["05:30:00Z", "12:00:00Z", "18:00:00Z", "23:59:00Z"];
  const base = new Date(ctYmd + "T00:00:00Z");
  const days = [-1, 0, 1];
  const out = [];
  for (const d of days) {
    const day = new Date(base.getTime() + d * 24 * 60 * 60 * 1000);
    const y = day.getUTCFullYear();
    const m = String(day.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(day.getUTCDate()).padStart(2, "0");
    for (const a of anchors) out.push(`${y}-${m}-${dd}T${a}`);
  }
  return out;
}

async function fetchSnapshot(dateIso) {
  const url = `${API_BASE}/historical/sports/${SPORT_KEY}/odds`;
  const { data } = await axios.get(url, {
    params: {
      apiKey: API_KEY,
      regions: REGIONS,
      markets: MARKET,
      bookmakers: BOOKMAKERS.join(","),
      oddsFormat: "american",
      date: dateIso
    },
    validateStatus: () => true
  });
  if (!data || !Array.isArray(data.data)) return { items: [], ts: null };
  return { items: data.data, ts: data.timestamp || null };
}

function teamId(name) {
  if (!name) return null;
  const k = name.trim().toUpperCase().replace(/\./g, "");
  return TEAM_NAME_TO_ID[k] ?? null;
}

async function loadMatchupsIndex() {
  const { data, error } = await supabase
    .from("mlb_matchups")
    .select("matchup_id, game_date, game_time_ct, home_team_id, away_team_id");
  if (error) throw error;
  const byDate = new Map();
  for (const r of data || []) {
    const d = r.game_date;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(r);
  }
  for (const arr of byDate.values()) {
    arr.sort((a, b) => (a.game_time_ct || "").localeCompare(b.game_time_ct || ""));
  }
  return byDate;
}

function pickMatchupId(byDate, ctDate, homeId, awayId, commenceUtc) {
  const list = byDate.get(ctDate) || [];
  const candidates = list.filter(
    (r) => r.home_team_id === homeId && r.away_team_id === awayId
  );
  if (candidates.length === 1) return candidates[0].matchup_id;
  if (candidates.length > 1) {
    const target = toCT(commenceUtc).toISOString();
    let best = null;
    let bestDiff = Infinity;
    for (const r of candidates) {
      const rt = r.game_time_ct || "";
      const diff = Math.abs(new Date(rt).getTime() - new Date(target).getTime());
      if (diff < bestDiff) {
        bestDiff = diff;
        best = r.matchup_id;
      }
    }
    return best || null;
  }
  return null;
}

function buildBookTimeline() {
  return { byBook: new Map() };
}

function pushPoint(tl, book, ts, home, away) {
  if (!book || ts == null) return;
  if (!tl.byBook.has(book)) tl.byBook.set(book, []);
  tl.byBook.get(book).push({ ts: new Date(ts), home, away });
}

function selectOpenClose(tl, commenceUtc) {
  let chosenBook = null;
  let open = null;
  let close = null;
  for (const bk of BOOKMAKERS) {
    const arr = tl.byBook.get(bk);
    if (!arr || !arr.length) continue;
    arr.sort((a, b) => a.ts - b.ts);
    const o = arr[0];
    let c = null;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i].ts.getTime() <= new Date(commenceUtc).getTime()) {
        c = arr[i];
        break;
      }
    }
    if (o && c) {
      chosenBook = bk;
      open = o;
      close = c;
      break;
    }
  }
  return { book: chosenBook, open, close };
}

async function upsertMovement(mid, gameDate, teamIdVal, source, openPt, closePt) {
  const payload = {
    matchup_id: mid,
    team_id: teamIdVal,
    game_date: gameDate,
    source: source,
    line_time_min: openPt.ts.toISOString(),
    line_min: teamIdVal === openPt.home.id ? openPt.home.ml : openPt.away.ml,
    line_time_max: closePt.ts.toISOString(),
    line_max: teamIdVal === closePt.home.id ? closePt.home.ml : closePt.away.ml
  };
  const { error } = await supabase
    .from("mlb_line_movements")
    .upsert(payload, { onConflict: "matchup_id,team_id,source" });
  if (error) throw error;
}

async function backfill() {
  if (!API_KEY) throw new Error("ODDS_API_KEY missing");
  if (!(await testConnection())) throw new Error("DB connection failed");
  const dates = await getTargetDates();
  const matchIdx = await loadMatchupsIndex();
  for (const ctDate of dates) {
    const probes = probeTimestampsForCTDay(ctDate);
    const timelines = new Map();
    for (const p of probes) {
      const snap = await fetchSnapshot(p);
      for (const ev of snap.items) {
        const homeId = teamId(ev.home_team);
        const awayId = teamId(ev.away_team);
        if (!homeId || !awayId) continue;
        const eid = ev.id;
        if (!timelines.has(eid)) timelines.set(eid, buildBookTimeline());
        for (const bm of ev.bookmakers || []) {
          if (!BOOKMAKERS.includes(bm.key)) continue;
          const m = (bm.markets || []).find((x) => x.key === MARKET);
          if (!m || !m.outcomes || m.outcomes.length < 2) continue;
          const oHome = m.outcomes.find((o) => o.name === ev.home_team);
          const oAway = m.outcomes.find((o) => o.name === ev.away_team);
          if (!oHome || !oAway) continue;
          const recHome = { id: homeId, ml: typeof oHome.price === "number" ? Math.round(oHome.price) : parseInt(oHome.price, 10) };
          const recAway = { id: awayId, ml: typeof oAway.price === "number" ? Math.round(oAway.price) : parseInt(oAway.price, 10) };
          pushPoint(timelines.get(eid), bm.key, m.last_update || bm.last_update || snap.ts, recHome, recAway);
        }
      }
    }
    for (const [eid, tl] of timelines.entries()) {
      let sampleEv = null;
      for (const bk of BOOKMAKERS) {
        const arr = tl.byBook.get(bk);
        if (arr && arr.length) {
          sampleEv = arr[0];
          break;
        }
      }
      if (!sampleEv) continue;
      const commence = [...tl.byBook.values()][0]?.[0]?.ts || null;
      let evMeta = null;
      for (const p of probes) {
        const snap = await fetchSnapshot(p);
        const found = (snap.items || []).find((x) => x.id === eid);
        if (found) {
          evMeta = found;
          break;
        }
      }
      if (!evMeta) continue;
      const homeId = teamId(evMeta.home_team);
      const awayId = teamId(evMeta.away_team);
      if (!homeId || !awayId) continue;
      const commenceUtc = evMeta.commence_time;
      const ctYmd = ymd(toCT(new Date(commenceUtc)));
      const mid = pickMatchupId(matchIdx, ctYmd, homeId, awayId, commenceUtc);
      if (!mid) continue;
      const sel = selectOpenClose(tl, commenceUtc);
      if (!sel.book || !sel.open || !sel.close) continue;
      const source = `OddsAPI:${sel.book}`;
      await upsertMovement(mid, ctYmd, homeId, source, sel.open, sel.close);
      await upsertMovement(mid, ctYmd, awayId, source, sel.open, sel.close);
    }
  }
}

if (process.argv[1]?.endsWith("backfillMlbCLV.js")) {
  backfill()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
