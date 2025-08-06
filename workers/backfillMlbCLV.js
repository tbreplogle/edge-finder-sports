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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getCTYmd(dateInput) {
  const d = new Date(dateInput);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = fmt.formatToParts(d).reduce((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isoNoMs(dateLike) {
  const d = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${dd}T${hh}:${mm}:${ss}Z`;
}

function normKey(s) {
  if (!s) return "";
  let t = String(s).toUpperCase().trim();
  t = t.replace(/\./g, "");
  t = t.replace(/\s+/g, " ");
  t = t.replace(/\bN Y\b/g, "NEW YORK");
  t = t.replace(/\bNY\b/g, "NEW YORK");
  t = t.replace(/\bL A\b/g, "LOS ANGELES");
  t = t.replace(/\bLA\b/g, "LOS ANGELES");
  t = t.replace(/\bST LOUIS\b/g, "ST LOUIS");
  return t;
}

function makeNameVariants(rec) {
  const out = new Set();
  const full = rec.actual_team_name;
  const abbr = rec.team_abbr;
  const alt = rec.alt_name;
  if (full) {
    const n = normKey(full);
    out.add(n);
    out.add(n.replace("LOS ANGELES", "LA"));
    out.add(n.replace("NEW YORK", "NY"));
    out.add(n.replace("ST LOUIS", "ST LOUIS"));
  }
  if (abbr) out.add(normKey(abbr));
  if (alt) {
    const altN = normKey(alt);
    out.add(altN);
    if (full) {
      const parts = normKey(full).split(" ");
      const nick = parts.slice(-1).join(" ");
      out.add(`${altN} ${nick}`);
    }
    out.add(altN.replace("LOS ANGELES", "LA"));
    out.add(altN.replace("NEW YORK", "NY"));
  }
  return [...out].filter(Boolean);
}

async function loadTeamMap() {
  const { data, error } = await supabase
    .from("teams_mlb")
    .select("team_id, team_abbr, actual_team_name, alt_name");
  if (error) throw error;
  const nameToId = new Map();
  const idToRecord = new Map();
  for (const rec of data || []) {
    const tid = rec.team_id;
    if (tid == null) continue;
    idToRecord.set(tid, rec);
    for (const v of makeNameVariants(rec)) {
      if (!nameToId.has(v)) nameToId.set(v, tid);
    }
  }
  console.log(`🔎 loaded teams_mlb: rows=${(data||[]).length}, keys=${nameToId.size}`);
  console.log(
    `  e.g. GUARDIANS->${nameToId.get("GUARDIANS") || "—"} / CLEVELAND GUARDIANS->${nameToId.get("CLEVELAND GUARDIANS") || "—"} / NY METS->${nameToId.get("NY METS") || "—"}`
  );
  return { nameToId, idToRecord };
}

function teamIdFromMap(nameToId, raw) {
  const k = normKey(raw);
  if (nameToId.has(k)) return nameToId.get(k);
  const parts = k.split(" ");
  if (parts.length >= 2) {
    const nick = parts[parts.length - 1];
    if (!["SOX"].includes(nick)) {
      for (const [key, val] of nameToId.entries()) {
        if (key === nick || key.endsWith(` ${nick}`)) return val;
      }
    }
  }
  return null;
}

async function getDistinctBetDates() {
  const { data, error } = await supabase
    .from("mlb_daily_bets")
    .select("game_date")
    .order("game_date", { ascending: true });
  if (error) throw error;
  const dates = [...new Set((data || []).map(r => r.game_date))];
  if (!dates.length) dates.push(getCTYmd(new Date()));
  return dates;
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
async function fetchSnapshot(dateIsoRaw) {
  const dateIso = isoNoMs(dateIsoRaw);
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
    console.warn(`  ⚠️ snapshot ${dateIso} resp=${resp.status} msg=${resp.data?.message || resp.statusText}`);
    const res = { items: [], ts: null, status: resp.status };
    snapshotCache.set(dateIso, res);
    return res;
  }
  const items = Array.isArray(resp.data?.data) ? resp.data.data : [];
  const res = { items, ts: resp.data?.timestamp || null, status: 200 };
  snapshotCache.set(dateIso, res);
  return res;
}

async function loadMatchupsIndex() {
  const { data, error } = await supabase
    .from("mlb_matchups")
    .select("matchup_id, game_date, game_time_ct, home_team_id, away_team_id");
  if (error) throw error;
  const byDate = new Map();
  const byId = new Map();
  for (const r of data || []) {
    if (!byDate.has(r.game_date)) byDate.set(r.game_date, []);
    byDate.get(r.game_date).push(r);
    byId.set(r.matchup_id, r);
  }
  for (const arr of byDate.values()) {
    arr.sort((a, b) => (a.game_time_ct || "").localeCompare(b.game_time_ct || ""));
  }
  return { byDate, byId };
}

function buildBookTimeline() {
  return { byBook: new Map() };
}

function pushPoint(tl, book, ts, homeId, homeMl, awayId, awayMl) {
  if (!book || ts == null) return;
  if (!tl.byBook.has(book)) tl.byBook.set(book, []);
  tl.byBook.get(book).push({
    ts: new Date(ts),
    home: { id: homeId, ml: Number(homeMl) },
    away: { id: awayId, ml: Number(awayMl) }
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
      if (arr[i].ts.getTime() <= startTs) { c = arr[i]; break; }
    }
    if (o && c) { chosenBook = bk; open = o; close = c; estimated = false; break; }
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

async function loadBetsIndexForWindow() {
  const { data, error } = await supabase
    .from("mlb_daily_bets")
    .select("matchup_id, game_date, team_id");
  if (error) throw error;
  const rows = data || [];
  const byDateTeam = new Map();
  const allowedMidSet = new Set();
  const dates = new Set();
  for (const r of rows) {
    const key = `${r.game_date}|${r.team_id}`;
    if (!byDateTeam.has(key)) byDateTeam.set(key, new Set());
    byDateTeam.get(key).add(r.matchup_id);
    if (r.matchup_id != null) allowedMidSet.add(r.matchup_id);
    dates.add(r.game_date);
  }
  return { byDateTeam, allowedMidSet, distinctDates: [...dates].sort() };
}

function findMidFromBets(betsIdx, ctDate, homeId, awayId) {
  const kHome = `${ctDate}|${homeId}`;
  const kAway = `${ctDate}|${awayId}`;
  const setH = betsIdx.byDateTeam.get(kHome) || new Set();
  const setA = betsIdx.byDateTeam.get(kAway) || new Set();
  if (setH.size === 1 && setA.size === 0) return [...setH][0];
  if (setA.size === 1 && setH.size === 0) return [...setA][0];
  if (setH.size && setA.size) {
    const inter = [...setH].filter((m) => setA.has(m));
    if (inter.length === 1) return inter[0];
    return null;
  }
  if (setH.size === 1) return [...setH][0];
  if (setA.size === 1) return [...setA][0];
  return null;
}

function pickMatchupId(matchIdxByDate, betsIdx, ctDate, homeId, awayId, commenceUtc, allowedMidSetForDate) {
  const list = matchIdxByDate.get(ctDate) || [];
  const candidates = list.filter(
    (r) => r.home_team_id === homeId && r.away_team_id === awayId
  );
  if (candidates.length === 1) {
    if (!allowedMidSetForDate || allowedMidSetForDate.has(candidates[0].matchup_id)) return candidates[0].matchup_id;
    return null;
  }
  if (candidates.length > 1) {
    const target = new Date(commenceUtc).getTime();
    let best = null, bestDiff = Infinity;
    for (const r of candidates) {
      if (allowedMidSetForDate && !allowedMidSetForDate.has(r.matchup_id)) continue;
      const t = new Date(r.game_time_ct).getTime();
      const diff = Math.abs(t - target);
      if (diff < bestDiff) { bestDiff = diff; best = r.matchup_id; }
    }
    if (best != null) return best;
  }
  const fromBets = findMidFromBets(betsIdx, ctDate, homeId, awayId);
  if (fromBets && (!allowedMidSetForDate || allowedMidSetForDate.has(fromBets))) return fromBets;
  const d0 = new Date(ctDate);
  const dMinus = new Date(d0.getTime() - 86400000);
  const dPlus = new Date(d0.getTime() + 86400000);
  const ymd = (d) => getCTYmd(d);
  const tryMinus = findMidFromBets(betsIdx, ymd(dMinus), homeId, awayId);
  if (tryMinus && (!allowedMidSetForDate || allowedMidSetForDate.has(tryMinus))) return tryMinus;
  const tryPlus = findMidFromBets(betsIdx, ymd(dPlus), homeId, awayId);
  if (tryPlus && (!allowedMidSetForDate || allowedMidSetForDate.has(tryPlus))) return tryPlus;
  return null;
}

function buildAllowedPairSets(allowedMidSet, matchById) {
  const byDatePairs = new Map();
  for (const mid of allowedMidSet) {
    const rec = matchById.get(mid);
    if (!rec) continue;
    const key = rec.game_date;
    if (!byDatePairs.has(key)) byDatePairs.set(key, new Set());
    byDatePairs.get(key).add(`${rec.home_team_id}:${rec.away_team_id}`);
  }
  return byDatePairs;
}

async function backfill() {
  const started = new Date().toISOString();
  if (!API_KEY) throw new Error("ODDS_API_KEY missing");
  console.log(`🏁 Backfill start ${started}`);
  if (!(await testConnection())) throw new Error("DB connection failed");

  const { nameToId } = await loadTeamMap();
  const { byDate: matchIdxByDate, byId: matchIdxById } = await loadMatchupsIndex();
  const betsIdx = await loadBetsIndexForWindow();

  const allowedPairsByDate = buildAllowedPairSets(betsIdx.allowedMidSet, matchIdxById);
  const targetDates = betsIdx.distinctDates.length ? betsIdx.distinctDates : await getDistinctBetDates();

  console.log(`✅ Successfully connected to Supabase`);
  console.log(`⏱️  Backfill dates (bets only): ${targetDates[0]} → ${targetDates[targetDates.length - 1]}`);

  let totalEvents = 0;
  let totalWithLines = 0;
  let totalUpserts = 0;
  let estimatedCloses = 0;

  for (let di = 0; di < targetDates.length; di++) {
    const ctDate = targetDates[di];
    const probes = probeTimestampsForCTDay(ctDate);
    console.log(`📅 ${ctDate} • probes=${probes.length} • progress ${di + 1}/${targetDates.length}`);

    const timelines = new Map();
    const meta = new Map();
    const allowedMidSetForDate = new Set(
      (betsIdx.allowedMidSet ? [...betsIdx.allowedMidSet] : []).filter(mid => (matchIdxById.get(mid)?.game_date === ctDate))
    );
    const allowedPairs = allowedPairsByDate.get(ctDate) || new Set();

    for (let pi = 0; pi < probes.length; pi++) {
      const p = probes[pi];
      const snap = await fetchSnapshot(p);
      console.log(`  • probe ${pi + 1}/${probes.length} @ ${p} → status=${snap.status} events=${snap.items.length}`);
      if (snap.status !== 200 || !snap.items.length) { await sleep(120); continue; }

      for (const ev of snap.items) {
        const hid = teamIdFromMap(nameToId, ev.home_team);
        const aid = teamIdFromMap(nameToId, ev.away_team);
        if (!hid || !aid) continue;

        const ctYmd = getCTYmd(ev.commence_time);
        if (ctYmd !== ctDate) continue;

        if (!allowedPairs.has(`${hid}:${aid}`)) continue;

        if (!timelines.has(ev.id)) timelines.set(ev.id, buildBookTimeline());
        if (!meta.has(ev.id)) meta.set(ev.id, {
          home_id: hid, away_id: aid,
          commence_time: ev.commence_time,
          home_name: ev.home_team, away_name: ev.away_team
        });

        totalEvents++;

        for (const bm of ev.bookmakers || []) {
          if (!BOOKMAKERS.includes(bm.key)) continue;
          const m = (bm.markets || []).find((x) => x.key === MARKET);
          if (!m || !m.outcomes || m.outcomes.length < 2) continue;
          const oH = m.outcomes.find((o) => normKey(o.name) === normKey(ev.home_team));
          const oA = m.outcomes.find((o) => normKey(o.name) === normKey(ev.away_team));
          if (!oH || !oA) continue;
          const ts = m.last_update || bm.last_update || snap.ts;
          pushPoint(timelines.get(ev.id), bm.key, ts, hid, oH.price, aid, oA.price);
        }
      }
      await sleep(120);
    }

    const extraTimes = new Set();
    for (const [eid, tl] of timelines.entries()) {
      let needs = false;
      for (const bk of BOOKMAKERS) {
        const arr = tl.byBook.get(bk);
        if (!arr || arr.length <= 1) { needs = true; break; }
      }
      if (needs) {
        const m = meta.get(eid);
        if (!m?.commence_time) continue;
        const t = new Date(m.commence_time).getTime();
        extraTimes.add(isoNoMs(new Date(t - 60 * 60 * 1000)));
        extraTimes.add(isoNoMs(new Date(t - 5 * 60 * 1000)));
      }
    }

    if (extraTimes.size) {
      console.log(`  ↻ extra commence-adjacent probes: n=${extraTimes.size}`);
      for (const et of extraTimes) {
        const snap = await fetchSnapshot(et);
        console.log(`    • extra @ ${et} → status=${snap.status} events=${snap.items.length}`);
        if (snap.status !== 200 || !snap.items.length) { await sleep(120); continue; }
        for (const ev of snap.items) {
          const hid = teamIdFromMap(nameToId, ev.home_team);
          const aid = teamIdFromMap(nameToId, ev.away_team);
          if (!hid || !aid) continue;
          const ctYmd = getCTYmd(ev.commence_time);
          if (ctYmd !== ctDate) continue;
          const allowedPairs = allowedPairsByDate.get(ctDate) || new Set();
          if (!allowedPairs.has(`${hid}:${aid}`)) continue;

          if (!timelines.has(ev.id)) timelines.set(ev.id, buildBookTimeline());
          if (!meta.has(ev.id)) meta.set(ev.id, {
            home_id: hid, away_id: aid,
            commence_time: ev.commence_time,
            home_name: ev.home_team, away_name: ev.away_team
          });

          for (const bm of ev.bookmakers || []) {
            if (!BOOKMAKERS.includes(bm.key)) continue;
            const mkt = (bm.markets || []).find((x) => x.key === MARKET);
            if (!mkt || !mkt.outcomes || mkt.outcomes.length < 2) continue;
            const oH = mkt.outcomes.find((o) => normKey(o.name) === normKey(ev.home_team));
            const oA = mkt.outcomes.find((o) => normKey(o.name) === normKey(ev.away_team));
            if (!oH || !oA) continue;
            const ts = mkt.last_update || bm.last_update || snap.ts;
            pushPoint(timelines.get(ev.id), bm.key, ts, hid, oH.price, aid, oA.price);
          }
        }
        await sleep(120);
      }
    }

    let dayUpserts = 0;
    let dayEvents = 0;

    for (const [eid, tl] of timelines.entries()) {
      const m = meta.get(eid);
      if (!m) continue;

      const ctYmd = getCTYmd(m.commence_time);
      const allowedMidSetForDate = new Set(
        (betsIdx.allowedMidSet ? [...betsIdx.allowedMidSet] : []).filter(mid => (matchIdxById.get(mid)?.game_date === ctYmd))
      );
      const mid = pickMatchupId(
        matchIdxByDate,
        betsIdx,
        ctYmd,
        m.home_id,
        m.away_id,
        m.commence_time,
        allowedMidSetForDate
      );

      if (!mid) continue;
      if (!betsIdx.allowedMidSet.has(mid)) continue;

      const sel = selectOpenClose(tl, m.commence_time);
      if (!sel.book || !sel.open || !sel.close) continue;

      dayEvents++;
      totalWithLines++;

      const sameTs = sel.open.ts.getTime() === sel.close.ts.getTime();
      const samePrices =
        sel.open.home.ml === sel.close.home.ml &&
        sel.open.away.ml === sel.close.away.ml;

      const src = `OddsAPI:${sel.book}${sel.estimated ? ":est" : ""}${(sameTs || samePrices) ? ":single" : ""}`;

      try {
        await upsertMovement(mid, ctYmd, m.home_id, src, sel.open, sel.close);
        await upsertMovement(mid, ctYmd, m.away_id, src, sel.open, sel.close);
        dayUpserts += 2;
        totalUpserts += 2;
        if (sel.estimated) estimatedCloses += 2;
        console.log(`  ✅ mid=${mid} book=${sel.book}${sel.estimated ? " (est close)" : ""}${(sameTs || samePrices) ? " (single)" : ""} upserted 2 rows`);
      } catch (e) {
        console.error(`  ❌ upsert mid=${mid} book=${sel.book} err=${e.message}`);
      }
    }

    console.log(`📊 ${ctDate} summary: events=${timelines.size} matched=${dayEvents} upserts=${dayUpserts}`);
  }

  console.log(`🎯 Done. totals: events_seen=${totalEvents}, with_lines=${totalWithLines}, upserts=${totalUpserts}, estimated_closes=${estimatedCloses}`);
}

if (process.argv[1]?.endsWith("backfillMlbCLV.js")) {
  backfill()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
