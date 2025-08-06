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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const toCT = (d) => new Date(new Date(d).getTime() - 5 * 60 * 60 * 1000);
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
  for (let t = s; t < e; t = new Date(t.getTime() + 86400000)) out.push(ymd(t));
  return out;
}

function probeTimestampsForCTDay(ctYmd) {
  const anchors = ["05:30:00Z", "12:00:00Z", "18:00:00Z", "23:59:00Z"];
  const base = new Date(ctYmd + "T00:00:00Z");
  const days = [-1, 0, 1];
  const out = [];
  for (const d of days) {
    const day = new Date(base.getTime() + d * 86400000);
    const y = day.getUTCFullYear();
    const m = String(day.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(day.getUTCDate()).padStart(2, "0");
    for (const a of anchors) out.push(`${y}-${m}-${dd}T${a}`);
  }
  return out;
}

const snapshotCache = new Map();
async function fetchSnapshot(dateIso) {
  if (snapshotCache.has(dateIso)) return snapshotCache.get(dateIso);
  const url = `${API_BASE}/historical/sports/${SPORT_KEY}/odds`;
  const resp = await axios.get(url, {
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
  if (resp.status !== 200) {
    console.warn(`⚠️  Snapshot ${dateIso} resp=${resp.status} msg=${resp.data?.message || resp.statusText}`);
    const res = { items: [], ts: null, status: resp.status };
    snapshotCache.set(dateIso, res);
    return res;
  }
  const items = Array.isArray(resp.data?.data) ? resp.data.data : [];
  const res = { items, ts: resp.data?.timestamp || null, status: 200 };
  snapshotCache.set(dateIso, res);
  return res;
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
  return { byBook: new Map(), meta: null };
}

function pushPoint(tl, book, ts, homeId, homeMl, awayId, awayMl) {
  if (!book || ts == null) return;
  if (!tl.byBook.has(book)) tl.byBook.set(book, []);
  tl.byBook.get(book).push({
    ts: new Date(ts),
    home: { id: homeId, ml: typeof homeMl === "number" ? Math.round(homeMl) : parseInt(homeMl, 10) },
    away: { id: awayId, ml: typeof awayMl === "number" ? Math.round(awayMl) : parseInt(awayMl, 10) }
  });
}

function selectOpenClose(tl, commenceUtc) {
  let chosenBook = null;
  let open = null;
  let close = null;
  let estimated = false;
  const startTs = new Date(commenceUtc).getTime();
  for (const bk of BOOKMAKERS) {
    const arr = tl.byBook.get(bk);
    if (!arr || !arr.length) continue;
    arr.sort((a, b) => a.ts - b.ts);
    const o = arr[0];
    let c = null;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i].ts.getTime() <= startTs) {
        c = arr[i];
        break;
      }
    }
    if (o && c) {
      chosenBook = bk;
      open = o;
      close = c;
      estimated = false;
      break;
    }
  }
  if (!open || !close) {
    for (const bk of BOOKMAKERS) {
      const arr = tl.byBook.get(bk);
      if (!arr || !arr.length) continue;
      arr.sort((a, b) => a.ts - b.ts);
      chosenBook = bk;
      open = arr[0];
      close = arr[arr.length - 1];
      estimated = true;
      break;
    }
  }
  return { book: chosenBook, open, close, estimated };
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
  const started = new Date().toISOString();
  if (!API_KEY) throw new Error("ODDS_API_KEY missing");
  console.log(`🏁 Backfill start ${started}`);
  if (!(await testConnection())) throw new Error("DB connection failed");
  const dates = await getTargetDates();
  const matchIdx = await loadMatchupsIndex();
  console.log(`⏱️  Backfill window (CT): ${dates[0]} → ${dates[dates.length - 1]}`);
  let totalEvents = 0;
  let totalWithLines = 0;
  let totalUpserts = 0;
  let estimatedCloses = 0;

  for (let di = 0; di < dates.length; di++) {
    const ctDate = dates[di];
    const probes = probeTimestampsForCTDay(ctDate);
    console.log(`\n📅 ${ctDate} • probes=${probes.length}`);
    const timelines = new Map();
    const meta = new Map();

    for (let pi = 0; pi < probes.length; pi++) {
      const p = probes[pi];
      const snap = await fetchSnapshot(p);
      console.log(`  • probe ${pi + 1}/${probes.length} @ ${p} → status=${snap.status} events=${snap.items.length}`);
      if (snap.status !== 200 || !snap.items.length) { await sleep(150); continue; }
      for (const ev of snap.items) {
        const hid = teamId(ev.home_team);
        const aid = teamId(ev.away_team);
        if (!hid || !aid) continue;
        totalEvents++;
        if (!timelines.has(ev.id)) timelines.set(ev.id, buildBookTimeline());
        if (!meta.has(ev.id)) meta.set(ev.id, { home_id: hid, away_id: aid, commence_time: ev.commence_time, home_name: ev.home_team, away_name: ev.away_team });
        for (const bm of ev.bookmakers || []) {
          if (!BOOKMAKERS.includes(bm.key)) continue;
          const m = (bm.markets || []).find((x) => x.key === MARKET);
          if (!m || !m.outcomes || m.outcomes.length < 2) continue;
          const oH = m.outcomes.find((o) => o.name === ev.home_team);
          const oA = m.outcomes.find((o) => o.name === ev.away_team);
          if (!oH || !oA) continue;
          pushPoint(timelines.get(ev.id), bm.key, m.last_update || bm.last_update || snap.ts, hid, oH.price, aid, oA.price);
        }
      }
      await sleep(150);
    }

    let dayUpserts = 0;
    for (const [eid, tl] of timelines.entries()) {
      const m = meta.get(eid);
      if (!m) continue;
      const ctYmd = ymd(toCT(new Date(m.commence_time)));
      const mid = pickMatchupId(matchIdx, ctYmd, m.home_id, m.away_id, m.commence_time);
      if (!mid) {
        console.warn(`  ⚠️  no matchup_id for event ${eid} (${m.away_name} @ ${m.home_name}) on ${ctYmd}`);
        continue;
      }
      const sel = selectOpenClose(tl, m.commence_time);
      if (!sel.book || !sel.open || !sel.close) {
        console.warn(`  ⚠️  no open/close for event ${eid} mid=${mid}`);
        continue;
      }
      totalWithLines++;
      const src = `OddsAPI:${sel.book}${sel.estimated ? ":est" : ""}`;
      try {
        await upsertMovement(mid, ctYmd, m.home_id, src, sel.open, sel.close);
        await upsertMovement(mid, ctYmd, m.away_id, src, sel.open, sel.close);
        dayUpserts += 2;
        totalUpserts += 2;
        if (sel.estimated) estimatedCloses += 2;
        console.log(`  ✅ mid=${mid} book=${sel.book} ${sel.estimated ? "(est close)" : ""} upserted 2 rows`);
      } catch (e) {
        console.error(`  ❌ upsert mid=${mid} book=${sel.book} err=${e.message}`);
      }
    }

    console.log(`📊 ${ctDate} summary: events=${timelines.size} upserts=${dayUpserts}`);
  }

  console.log(`\n🎯 Done. totals: events_seen=${totalEvents}, with_lines=${totalWithLines}, upserts=${totalUpserts}, estimated_closes=${estimatedCloses}`);
}

if (process.argv[1]?.endsWith("backfillMlbCLV.js")) {
  backfill()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
