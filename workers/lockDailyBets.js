/* Lock today’s ≥7-confidence bets (isotonic-calibrated + Kelly-based) */
import { supabase, testConnection } from './lib/supabaseClient.js';

function todayCT() {
  const ct = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
  );
  return ct.toISOString().slice(0, 10);
}

/* Moneyline helpers */
function impFromML(ml) {
  return ml < 0 ? (-ml) / ((-ml) + 100.0) : 100.0 / (ml + 100.0);
}
function decimalReturn(ml) { // b = decimal_odds - 1
  return ml >= 0 ? ml / 100.0 : 100.0 / (-ml);
}
function stakeForWin100(ml) { // fixed to win 100
  return ml < 0 ? Math.abs(ml) : +(10000 / ml).toFixed(2);
}
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/* Load isotonic map: rows with {side,favdog,b_lo,b_hi,p_cal} */
async function loadIsoMap() {
  const { data, error } = await supabase
    .from('v_mlb_iso_calib_map')
    .select('side,favdog,b_lo,b_hi,p_cal')
    .order('side', { ascending: true })
    .order('favdog', { ascending: true })
    .order('b_lo', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/* Find calibrated p by bin; fallback to raw p if no bin found */
function isoCalibrate(p, side, ml, map) {
  const favdog = ml < 0 ? 'fav' : 'dog';
  const rows = mapByKey(map, side, favdog);
  for (const r of rows) {
    if (p >= r.b_lo && p <= r.b_hi) return clamp(r.p_cal, 1e-6, 1 - 1e-6);
  }
  return clamp(p, 1e-6, 1 - 1e-6); // graceful fallback
}
function mapByKey(map, side, favdog) {
  return map.filter(r => r.side === side && r.favdog === favdog);
}

/* Kelly */
function kellyFraction(p, ml) {
  const b = decimalReturn(ml);
  return (b * p - (1 - p)) / b; // can be negative
}

/* Context nudges (minimal; derived from your P&L) */
const hardPenaltyTeams = new Set(['CHI. WHITE SOX', 'ATHLETICS', 'ARIZONA']);

function adjustKelly(k, { ml, side, team }) {
  let kk = k;

  // Small favorites were a leak; require more margin there
  if (ml <= -101 && ml >= -150) kk -= 0.015; // ~1.5% Kelly reduction

  // Medium dogs have been your sweet spot; tiny bump
  if (ml >= 121 && ml <= 200) kk += 0.003;

  // Away sides underperform
  if (side === 'away') kk -= 0.010;

  // Temporary systematic team penalties
  if (hardPenaltyTeams.has(team)) kk -= 0.020;

  return kk;
}

/* Kelly -> 0..10 confidence (monotone) */
function confFromKelly(k) {
  const kClamped = clamp(k, -0.05, 0.20);        // sanity
  const kMin = 0.00;                             // 0% Kelly -> 0
  const kMax = 0.08;                             // 8% Kelly -> 10
  const score = 10 * ((kClamped - kMin) / (kMax - kMin));
  return +clamp(score, 0, 10).toFixed(1);
}

async function lockDailyBets() {
  if (!(await testConnection())) throw new Error('DB connection failed');
  const today = todayCT();

  const isoMap = await loadIsoMap();

  // 1) today’s preds (model probs + market MLs)
  const { data: preds, error: predErr } = await supabase
    .from('mlb_predictions_with_market')
    .select(`
      matchup_id, game_time_ct,
      home_team, away_team,
      home_market_ml, away_market_ml,
      home_pred_pct, away_pred_pct
    `)
    .gte('game_time_ct', `${today}T00:00:00-05:00`)
    .lt ('game_time_ct', `${today}T23:59:59-05:00`);
  if (predErr) throw predErr;

  // 2) team IDs
  const { data: metas, error: metaErr } = await supabase
    .from('mlb_matchups')
    .select('matchup_id, home_team_id, away_team_id')
    .eq('game_date', today);
  if (metaErr) throw metaErr;
  const metaById = Object.fromEntries((metas ?? []).map(m => [m.matchup_id, m]));

  // 3) build bets using calibrated Kelly-based confidence
  const bets = (preds ?? [])
    .filter(r =>
      r.home_market_ml != null && r.away_market_ml != null &&
      r.home_pred_pct   != null && r.away_pred_pct   != null &&
      metaById[r.matchup_id]
    )
    .map(r => {
      const meta = metaById[r.matchup_id];

      // Calibrate by segment bins
      const pHome = isoCalibrate(+r.home_pred_pct, 'home', r.home_market_ml, isoMap);
      const pAway = isoCalibrate(+r.away_pred_pct, 'away', r.away_market_ml, isoMap);

      // Kelly fractions
      const kHomeRaw = kellyFraction(pHome, r.home_market_ml);
      const kAwayRaw = kellyFraction(pAway, r.away_market_ml);

      // Context-adjusted Kelly
      const kHome = adjustKelly(kHomeRaw, { ml: r.home_market_ml, side: 'home', team: r.home_team });
      const kAway = adjustKelly(kAwayRaw, { ml: r.away_market_ml, side: 'away', team: r.away_team });

      // Confidence scores
      const confHome = confFromKelly(kHome);
      const confAway = confFromKelly(kAway);

      // Pick higher confidence side
      const betHome = confHome >= confAway;

      const moneyline = betHome ? r.home_market_ml : r.away_market_ml;
      const team_id   = betHome ? meta.home_team_id : meta.away_team_id;
      const team_name = betHome ? r.home_team       : r.away_team;
      const confidence = betHome ? confHome : confAway;
      const stake     = stakeForWin100(moneyline);

      return {
        matchup_id : r.matchup_id,
        game_date  : today,
        team_id,
        team_name,
        confidence,   // 0..10
        moneyline,
        stake,
        to_win     : 100
      };
    })
    .filter(b => b.confidence >= 7.0); // your existing gate

  console.log(`Locking ${bets.length} bets for ${today}`);
  if (!bets.length) return;

  const { error: upErr } = await supabase
    .from('mlb_daily_bets')
    .upsert(bets, { onConflict: 'matchup_id' });

  if (upErr) throw upErr;
  console.log('✅ Bets locked.');
}

if (import.meta.url.endsWith('lockDailyBets.js')) {
  lockDailyBets()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
