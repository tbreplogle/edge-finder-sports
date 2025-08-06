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

function normKey(s) {
  if (!s) return "";
  let t = String(s).toUpperCase().trim();

  // normalize punctuation/spacing
  t = t.replace(/\./g, "");     // "ST. LOUIS" -> "ST LOUIS", "CHI. CUBS" -> "CHI CUBS"
  t = t.replace(/\s+/g, " ");

  // common city shorthand expansions
  t = t.replace(/\bN Y\b/g, "NEW YORK");
  t = t.replace(/\bNY\b/g, "NEW YORK");
  t = t.replace(/\bL A\b/g, "LOS ANGELES");
  t = t.replace(/\bLA\b/g, "LOS ANGELES");
  t = t.replace(/\bST LOUIS\b/g, "ST LOUIS"); // ensure no period form
  return t;
}

function makeNameVariants(rec) {
  const out = new Set();

  const full = rec.actual_team_name; // e.g., "Cleveland Guardians"
  const abbr = rec.team_abbr;        // e.g., "CLE"
  const alt  = rec.alt_name;         // e.g., "CLEVELAND" or "ST. LOUIS"

  if (full) {
    out.add(normKey(full));                                // "CLEVELAND GUARDIANS"
    // generate LA/NY/ST. variants if present
    out.add(normKey(full).replace("LOS ANGELES", "LA"));
    out.add(normKey(full).replace("NEW YORK", "NY"));
    out.add(normKey(full).replace("ST LOUIS", "ST LOUIS")); // no-op safeguard
  }

  if (abbr) out.add(normKey(abbr));                        // "CLE"
  if (alt) {
    const altN = normKey(alt);                             // "CLEVELAND" / "ST LOUIS" / "CHI WHITE SOX"
    out.add(altN);
    // city + nickname from full if we have both
    if (full) {
      const parts = normKey(full).split(" ");
      const nick  = parts.slice(-1).join(" ");             // "GUARDIANS", "METS", "SOX"
      out.add(`${altN} ${nick}`);                          // "CLEVELAND GUARDIANS", "ST LOUIS CARDINALS"
    }
    // LA/NY short forms for alt city
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

  // sanity check + visibility
  console.log(`🔎 loaded teams_mlb: rows=${(data||[]).length}, keys=${nameToId.size}`);
  if ((data || []).length < 30 || nameToId.size < 40) {
    console.warn("  ⚠️ team map looks too small — check table/columns");
  }
  // quick sample to confirm mapping looks right
  console.log(
    `  e.g. GUARDIANS->${nameToId.get("GUARDIANS") || "—"} / CLEVELAND GUARDIANS->${nameToId.get("CLEVELAND GUARDIANS") || "—"} / NY METS->${nameToId.get("NY METS") || "—"}`
  );

  return { nameToId, idToRecord };
}

function teamIdFromMap(nameToId, raw) {
  const k = normKey(raw);

  // exact / variant key
  if (nameToId.has(k)) return nameToId.get(k);

  // try nickname-only (last word), but avoid obvious collisions like "SOX"
  const parts = k.split(" ");
  if (parts.length >= 2) {
    const nick = parts[parts.length - 1]; // GUARDIANS, METS, YANKEES, etc.
    if (!["SOX"].includes(nick)) {
      for (const [key, val] of nameToId.entries()) {
        if (key === nick || key.endsWith(` ${nick}`)) return val;
      }
    }
  }
  return null;
}

async function getEarliestBetDate() {
  const { data, error } = await supabase
    .from("mlb_daily_bets")
    .select("game_date")
    .order("game_date", { ascending: true })
    .limit(1);
  if (error) throw error;
  const first = data?.[0]?.game_date;
  if (first) return first;
  return getCTYmd(new Date());
}

async function getTargetDates() {
  const start = await getEarliestBetDate();
  const todayCT = getCTYmd(new Date());
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(todayCT + "T00:00:00Z");
  const out = [];
  for (let t = s; t <= e; t = new Date(t.getTime() + 86400000)) {
    out.push(getCTYmd(t));
  }
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

function pickMatchupId(matchupsByDate, ctDate, homeId, awayId, commenceUtc) {
  const list = matchupsByDate.get(ctDate) || [];
  const candidates = list.filter(
    (r) => r.home_team_id === homeId && r.away_team_id === awayId
  );
  if (candidates.length === 1) return candidates[0].matchup_id;
  if (candidates.length > 1) {
    const target = new Date(commenceUtc).getTime();
    let best = null, bestDiff = Infinity;
    for (const r of candidates) {
      const t = new Date(r.game_time_ct).getTime();
      const diff = Math.abs(t - target);
      if (diff < bestDiff) { bestDiff = diff; best = r.matchup_id; }
    }
    return best || null;
  }
  return null;
}

async function backfill() {
  const started = new Date().toISOString();
  if (!API_KEY) throw new Error("ODDS_API_KEY missing");
  console.log(`🏁 Backfill start ${started}`);

  if (!(await testConnection())) throw new Error("DB connection failed");
  const { nameToId } = await loadTeamMap();
  const dates = await getTargetDates();
  const matchIdx = await loadMatchupsIndex();

  console.log(`✅ Successfully connected to Supabase`);
  console.log(`⏱️  Backfill window (CT): ${dates[0]} → ${dates[dates.length - 1]}`);

  let totalEvents = 0;
  let totalWithLines = 0;
  let totalUpserts = 0;
  let estimatedCloses = 0;

  for (let di = 0; di < dates.length; di++) {
    const ctDate = dates[di];
    const probes = probeTimestampsForCTDay(ctDate);
    console.log(`📅 ${ctDate} • probes=${probes.length} • progress ${di + 1}/${dates.length}`);

    const timelines = new Map();
    const meta = new Map();

    for (let pi = 0; pi < probes.length; pi++) {
      const p = probes[pi];
      const snap = await fetchSnapshot(p);
      console.log(`  • probe ${pi + 1}/${probes.length} @ ${p} → status=${snap.status} events=${snap.items.length}`);
      if (snap.status !== 200 || !snap.items.length) { await sleep(120); continue; }

      for (const ev of snap.items) {
        const hid = teamIdFromMap(nameToId, ev.home_team);
        const aid = teamIdFromMap(nameToId, ev.away_team);
        if (!hid || !aid) {
          console.warn(`  ⚠️  unmapped team name(s): home="${ev.home_team}" (${hid}), away="${ev.away_team}" (${aid})`);
          continue;
        }
        totalEvents++;

        if (!timelines.has(ev.id)) timelines.set(ev.id, buildBookTimeline());
        if (!meta.has(ev.id)) meta.set(ev.id, {
          home_id: hid, away_id: aid,
          commence_time: ev.commence_time,
          home_name: ev.home_team, away_name: ev.away_team
        });

        for (const bm of ev.bookmakers || []) {
          if (!BOOKMAKERS.includes(bm.key)) continue;
          const m = (bm.markets || []).find((x) => x.key === MARKET);
          if (!m || !m.outcomes || m.outcomes.length < 2) continue;
          const oH = m.outcomes.find((o) => normKey(o.name) === normKey(ev.home_team));
          const oA = m.outcomes.find((o) => normKey(o.name) === normKey(ev.away_team));
          if (!oH || !oA) continue;
          pushPoint(timelines.get(ev.id), bm.key, m.last_update || bm.last_update || snap.ts, hid, oH.price, aid, oA.price);
        }
      }
      await sleep(120);
    }

    let dayUpserts = 0;
    let dayEvents = 0;

    for (const [eid, tl] of timelines.entries()) {
      const m = meta.get(eid);
      if (!m) continue;

      const ctYmd = getCTYmd(m.commence_time);
      const mid = pickMatchupId(matchIdx, ctYmd, m.home_id, m.away_id, m.commence_time);

      if (!mid) {
        const candidates = (matchIdx.get(ctYmd) || []).length;
        console.warn(`  ⚠️  no matchup_id for event ${eid} (${m.away_name} @ ${m.home_name}) on ${ctYmd} • candidates_on_date=${candidates} • home_id=${m.home_id} • away_id=${m.away_id}`);
        continue;
      }

      const sel = selectOpenClose(tl, m.commence_time);
      if (!sel.book || !sel.open || !sel.close) {
        console.warn(`  ⚠️  no open/close for event ${eid} mid=${mid}`);
        continue;
      }

      dayEvents++;
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

    console.log(`📊 ${ctDate} summary: events=${timelines.size} matched=${dayEvents} upserts=${dayUpserts}`);
  }

  console.log(`🎯 Done. totals: events_seen=${totalEvents}, with_lines=${totalWithLines}, upserts=${totalUpserts}, estimated_closes=${estimatedCloses}`);
}

if (process.argv[1]?.endsWith("backfillMlbCLV.js")) {
  backfill()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
