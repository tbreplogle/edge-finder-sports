// workers/fetchMlbOdds.js
/* eslint-disable no-console ------------------------------------------------- */
import axios from "axios";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { supabase, testConnection } from "./lib/supabaseClient.js";

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */
const ODDS_API_KEY = "907b67e00fc14e6f4a501355026dba0e";
const ODDS_API_URL = "https://api.the-odds-api.com/v4/sports";
const SPORT_KEY = "baseball_mlb";
const REGIONS     = "us";                                   // required param
const BOOKMAKERS  = "draftkings,fanduel,betmgm,caesars";
/* -------------------------------------------------------------------------- */
/* Team‑name → team_id map                                                    */
/* -------------------------------------------------------------------------- */
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
  "BALTIMORE ORIOLES": 30,
};

const getTeamId = (name) =>
  TEAM_NAME_TO_ID[name.trim().toUpperCase()] ?? null;

/* -------------------------------------------------------------------------- */
/* 1. Fetch raw odds                                                          */
/* -------------------------------------------------------------------------- */
async function fetchOddsApi() {
  console.log("🕵️  Fetching MLB odds …");
  const { data } = await axios.get(`${ODDS_API_URL}/${SPORT_KEY}/odds`, {
    params: {
      apiKey: ODDS_API_KEY,
      regions: "us",
      markets: "h2h",
      oddsFormat: "american",
      dateFormat: "iso",
    },
  });
  if (!Array.isArray(data)) throw new Error("Unexpected API response");
  console.log(`✅ Fetched ${data.length} games`);
  return data;
}

/* -------------------------------------------------------------------------- */
/* 2. Map API response → local skeleton                                       */
/* -------------------------------------------------------------------------- */
async function mapGame(game) {
  const home_team_id = getTeamId(game.home_team);
  const away_team_id = getTeamId(game.away_team);
  if (!home_team_id || !away_team_id) {
    console.warn(
      `⚠️  Unmapped teams: ${game.home_team} vs ${game.away_team}`
    );
    return null;
  }

  const market = game.bookmakers?.[0]?.markets.find((m) => m.key === "h2h");
  const h2h = market?.outcomes ?? [];
  const hML = h2h.find((o) => o.name === game.home_team)?.price ?? null;
  const aML = h2h.find((o) => o.name === game.away_team)?.price ?? null;

  const utc = new Date(game.commence_time);
  const cdt = new Date(utc.getTime() - 5 * 60 * 60 * 1e3); // UTC‑5

  return {
    game_id: game.id,
    game_date: cdt.toISOString().slice(0, 10),
    game_time_ct: cdt.toISOString(),
    home_team_id,
    away_team_id,
    home_ml: hML,
    away_ml: aML,
    home_pitcher_outs: null,
    away_pitcher_outs: null,
    matchup_id: null, // filled in later
  };
}

/* -------------------------------------------------------------------------- */
/* 3. Attach matchup_id                                                      */
/*    1) by game_id, 2) fallback composite (homeawaydate)                   */
/* -------------------------------------------------------------------------- */
/* ------------------------------------------------------------------
   3. Attach matchup_id
      – honour double-headers:     give each game its own matchup_id
-------------------------------------------------------------------*/
async function attachMatchupIds(records) {
  /* pull every matchup row we’ll need (today … but cheap either way) */
  const { data: matchups, error: e1 } = await supabase
    .from("mlb_matchups")
    .select(
      "matchup_id, game_id, home_team_id, away_team_id, game_date, game_time_ct"
    );
  if (e1) throw e1;

  /* find the ids we have *already* written to mlb_market_odds so we don’t
     hand them out twice when today has a DH                                       */
  const { data: existing, error: e2 } = await supabase
    .from("mlb_market_odds")
    .select("matchup_id")
    .not("matchup_id", "is", null);
  if (e2) throw e2;
  const alreadyUsed = new Set(existing.map(r => r.matchup_id));

  /* lookup-tables for speed                                                       */
  const byGameId = new Map(matchups.map(r => [r.game_id, r.matchup_id]));

  /*  home+away+date  →  [ list of matchup rows, earliest first ]                  */
  const byKey = new Map();
  for (const r of matchups) {
    const k = `${r.home_team_id}_${r.away_team_id}_${r.game_date}`;
    (byKey.get(k) ?? byKey.set(k, []).get(k)).push(r);
  }
  /* make sure the list is sorted by start-time so DH(1) comes before DH(2)        */
  for (const list of byKey.values()) {
    list.sort((a, b) => (a.game_time_ct ?? '').localeCompare(b.game_time_ct ?? ''));
  }

  /* keep track of matchup_ids we hand out *during this run*                       */
  const handedOut = new Set();

  return records.map(rec => {
    /* ① direct match by Odds-API game_id                                           */
    let mid = byGameId.get(rec.game_id);
    if (mid) {
      handedOut.add(mid);
      return { ...rec, matchup_id: mid };
    }

    /* ② find the list of candidate rows for this team/date                         */
    const k = `${rec.home_team_id}_${rec.away_team_id}_${rec.game_date}`;
    const candidates = byKey.get(k) || [];

    /*  → choose the *first* candidate whose id is not already in use               */
    for (const row of candidates) {
      if (!alreadyUsed.has(row.matchup_id) && !handedOut.has(row.matchup_id)) {
        mid = row.matchup_id;
        handedOut.add(mid);
        break;
      }
    }

    return { ...rec, matchup_id: mid ?? null };      // null → skipped later
  });
}


/* -------------------------------------------------------------------------- */
/* 4. Upsert                                                                 */
/* -------------------------------------------------------------------------- */
async function upsertOdds(records) {
  console.log(`→ Upserting ${records.length} rows into mlb_market_odds …`);
  const { data, error } = await supabase
    .from("mlb_market_odds")
    .upsert(records, { onConflict: "game_id" })
    .select();
  if (error) throw error;
  console.log(`✅ Upserted ${data.length}`);
  return data.length;
}

// ───────────────────────────────────────────────────────────────────────────
// Helper – return AVG outs line (numeric) or null
// ───────────────────────────────────────────────────────────────────────────
async function getPitcherOuts(eventId) {
  try {
    const resp = await axios.get(
      `${ODDS_API_URL}/${SPORT_KEY}/events/${eventId}/odds`,
      {
        params: {
          apiKey: ODDS_API_KEY,
          regions: REGIONS,
          markets: "pitcher_outs",
          bookmakers: BOOKMAKERS,          // draftkings,fanduel,betmgm,caesars
          oddsFormat: "american",
          dateFormat: "iso",
        },
        validateStatus: () => true         // don’t throw on 404 / 204
      }
    );

    /* If the book(s) haven’t posted this prop yet, bail gracefully */
    if (!resp.data || !resp.data.bookmakers?.length) return null;

/* ------------------------------------------------------------------
   Build ladders of prices per pitcher, then pick the point whose
   worst-leg price is closest to –110 / –110.  Returns { player → point }
-------------------------------------------------------------------*/
const ladders = {};   // { player: { '16.5': [125,-165], '17.5':[100,-130] } }

for (const bm of resp.data.bookmakers ?? []) {
  const mkt = bm.markets?.find(m => m.key === "pitcher_outs");
  if (!mkt) continue;

  for (const o of mkt.outcomes ?? []) {
    const player = o.player ?? o.participant ?? o.description;   // DK/FD use description
    if (!player || o.point == null) continue;

    const key = String(o.point);
    (ladders[player] ??= {})[key] ??= [];
    ladders[player][key].push(o.price);
  }
}

/* helper: distance of an American price from -110 */
const dist = (price) => Math.abs(price + 110);

const outs = {};  // final { player → bestPoint }

for (const [player, pts] of Object.entries(ladders)) {
  let bestPt  = null;
  let bestErr = Infinity;

  for (const [pt, prices] of Object.entries(pts)) {
    if (prices.length < 2) continue;              // need both Over & Under
    const worstSide = Math.max(dist(prices[0]), dist(prices[1]));
    if (worstSide < bestErr) {
      bestErr = worstSide;
      bestPt  = parseFloat(pt);
    }
  }

  if (bestPt != null) outs[player] = bestPt;
}

return Object.keys(outs).length ? outs : null;


  } catch (err) {
    console.warn(
      `⚠️  pitcher_outs fetch failed for ${eventId}:`,
      err.response?.status ?? err.message
    );
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* 5. Orchestrator                                                            */
/* -------------------------------------------------------------------------- */

async function fetchAndSyncMlbOdds() {
  console.log(`🏁 Sync started ${new Date().toISOString()}`);
  const stats = { fetched: 0, mapped: 0, with_matchup: 0, upserted: 0 };

  try {
    /* ── DB connectivity check ──────────────────────────────────────────── */
    if (!(await testConnection())) throw new Error("DB connection failed");

    /* ── 1) pull H-2-H board ────────────────────────────────────────────── */
    const raw = await fetchOddsApi();
    stats.fetched = raw.length;

    /* ── 2) shape into local skeletons ─────────────────────────────────── */
    const mapped = (await Promise.all(raw.map(mapGame))).filter(Boolean);
    stats.mapped = mapped.length;
    if (!mapped.length) throw new Error("No mapped games");

    /* ── 3) attach our matchup_id  ─────────────────────────────────────── */
    const joined = await attachMatchupIds(mapped);

    /* ── 4) enrich with Pitcher-Outs lines ─────────────────────────────── */
    for (const rec of joined) {
      if (!rec.matchup_id) continue;          // nothing to match yet

      /* 4-a  pull the two most-recent starters for these team_ids */
      const { data: pms, error } = await supabase
        .from("pitching_matchups")
        .select("pitcher_name, team_id, created_at")
        .in("team_id", [rec.home_team_id, rec.away_team_id])
        .order("created_at", { ascending: false })
        .limit(4);                            // safety – expect 2 rows

      if (error) throw error;

      const homeRaw =
        pms.find(p => p.team_id === rec.home_team_id)?.pitcher_name ?? "";
      const awayRaw =
        pms.find(p => p.team_id === rec.away_team_id)?.pitcher_name ?? "";

      /* helper → LAST name, strips “(R)/(L)”, dots, commas */
      const lastName = s =>
        s
          .replace(/\([^)]*\)/g, "")          // remove (R) / (L)
          .toUpperCase()
          .replace(/[^A-Z ]/g, " ")
          .trim()
          .split(/\s+/)
          .pop() || "";

      /* 4-b  one API call → { "Griffin Canning": 15.5, … } */
      const outsMap = await getPitcherOuts(rec.game_id) || {};

      /* 4-c  match by last name */
      let homeOuts = null,
          awayOuts = null;

      const homeLN = lastName(homeRaw);
      const awayLN = lastName(awayRaw);

      for (const [player, line] of Object.entries(outsMap)) {
        const ln = lastName(player);
        if (!homeOuts && ln === homeLN) homeOuts = line;
        else if (!awayOuts && ln === awayLN) awayOuts = line;
      }

      /* 4-d  if only one matched, copy that value to the other side */
      if (!homeOuts && awayOuts) homeOuts = awayOuts;
      if (!awayOuts && homeOuts) awayOuts = homeOuts;

      /* 4-e  write into the record (null if still unmatched) */
      rec.home_pitcher_outs = homeOuts;
      rec.away_pitcher_outs = awayOuts;
    }
/* 4-f  back-fill game_time_ct the FIRST time we see a matchup
        (only rows whose time is still NULL get touched)       */
        for (const r of joined) {
          if (!r.matchup_id || !r.game_time_ct) continue;
        
          const { error } = await supabase
            .from('mlb_matchups')
            .update({ game_time_ct: r.game_time_ct })   // plain value, no sql tag
            .eq('matchup_id', r.matchup_id)
            .is('game_time_ct', null);                  // only if still NULL
        
          if (error) throw error;
        }
        
    
    /* ── 5) upsert only rows with a matchup_id ─────────────────────────── */
    const ready = joined.filter(r => r.matchup_id);
    stats.with_matchup = ready.length;
    if (!ready.length) {
      throw new Error("No games matched to matchup_id (scraper out of sync)");
    }

    stats.upserted = await upsertOdds(ready);

    console.log("🎉 Sync complete", stats);
    return { success: true, stats };
  } catch (err) {
    console.error("❌ Sync failed:", err.message);
    return { success: false, error: err.message, stats };
  }
}


/* -------------------------------------------------------------------------- */
/* CLI entry                                                                  */
/* -------------------------------------------------------------------------- */
if (
  process.argv[1] ===
  resolve(dirname(fileURLToPath(import.meta.url)), "fetchMlbOdds.js")
) {
  fetchAndSyncMlbOdds()
    .then((res) => process.exit(res.success ? 0 : 1))
    .catch(() => process.exit(1));
}
