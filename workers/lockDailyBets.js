/*  Lock today’s ≥7-confidence bets (derived confidence) */
import { supabase, testConnection } from './lib/supabaseClient.js';

function todayCT() {
  const ct = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
  );
  return ct.toISOString().slice(0, 10);
}

/* ML -> implied probability */
function impFromML(ml) {
  return ml < 0
    ? (-ml) / ((-ml) + 100.0)
    : 100.0 / (ml + 100.0);
}

/* convert ML → stake needed to win exactly 100 */
function stakeForWin100(ml) {
  return ml < 0 ? Math.abs(ml) : +(10000 / ml).toFixed(2);
}

/* clamp helper */
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/* logistic helpers */
const logit    = p => Math.log(p / (1 - p));
const invlogit = z => 1 / (1 + Math.exp(-z));

/* fetch calibration coeffs if available, else identity */
async function getCalibration() {
  try {
    const { data, error } = await supabase
      .from('v_mlb_calib_coeffs')
      .select('slope,intercept')
      .limit(1)
      .maybeSingle();
    if (error || !data) return { slope: 1, intercept: 0 };
    return { slope: data.slope ?? 1, intercept: data.intercept ?? 0 };
  } catch {
    return { slope: 1, intercept: 0 };
  }
}

/* apply calibration to raw model prob */
function calibrate(p, slope, intercept) {
  const p1 = clamp(p, 1e-6, 1 - 1e-6);
  return invlogit(intercept + slope * logit(p1));
}

/* small, data-driven context tweaks – no bullpens/lineups needed */
const hardPenaltyTeams = new Set(['CHI. WHITE SOX', 'ATHLETICS', 'ARIZONA']); // soften later if results improve

function adjustedEdge({ edge, ml, side, team }) {
  let e = edge;

  // away sides underperform vs home -> small tax
  if (side === 'away') e -= 0.010; // -1.0%

  // small favorites are your leak -> extra gate
  if (ml <= -101 && ml >= -150) e -= 0.015; // -1.5%

  // medium dogs are your sweet spot -> tiny bump
  if (ml >= 121 && ml <= 200) e += 0.003; // +0.3%

  // temporary team penalties (systematic bias)
  if (hardPenaltyTeams.has(team)) e -= 0.020; // -2.0%

  return e;
}

/* map edge -> 0..10 confidence
   - minEdge = 1% -> conf 0
   - 7% edge -> conf 10
   So conf ~7 ≈ 5.5% adjusted edge. Tweak if too tight. */
function confFromEdge(e) {
  const minEdge = 0.01;
  const maxEdge = 0.07;
  const score = 10 * ((e - minEdge) / (maxEdge - minEdge));
  return +clamp(score, 0, 10).toFixed(1);
}

async function lockDailyBets() {
  if (!(await testConnection())) throw new Error('DB connection failed');
  const today = todayCT();

  const calib = await getCalibration();

  // 1) pull today’s preds with model probs + market MLs
  const { data: preds, error: predErr } = await supabase
    .from('mlb_predictions_with_market')
    .select(`
      matchup_id,
      game_time_ct,
      home_team, away_team,
      home_market_ml, away_market_ml,
      home_pred_pct, away_pred_pct
    `)
    .gte('game_time_ct', `${today}T00:00:00-05:00`)
    .lt ('game_time_ct', `${today}T23:59:59-05:00`);
  if (predErr) throw predErr;

  // 2) meta for team IDs
  const { data: metas, error: metaErr } = await supabase
    .from('mlb_matchups')
    .select('matchup_id, home_team_id, away_team_id')
    .eq('game_date', today);
  if (metaErr) throw metaErr;
  const metaById = Object.fromEntries((metas ?? []).map(m => [m.matchup_id, m]));

  // 3) build bets using DERIVED confidence
  const bets = (preds ?? [])
    .filter(r =>
      r.home_market_ml != null && r.away_market_ml != null &&
      r.home_pred_pct   != null && r.away_pred_pct   != null &&
      metaById[r.matchup_id]
    )
    .map(r => {
      const meta = metaById[r.matchup_id];

      // Calibrated probs
      const pHome = calibrate(+r.home_pred_pct, calib.slope, calib.intercept);
      const pAway = calibrate(+r.away_pred_pct, calib.slope, calib.intercept);

      // Implied probs from market
      const impHome = impFromML(r.home_market_ml);
      const impAway = impFromML(r.away_market_ml);

      // Raw edges
      const edgeHome = pHome - impHome;
      const edgeAway = pAway - impAway;

      // Context-adjusted edges
      const adjHome = adjustedEdge({ edge: edgeHome, ml: r.home_market_ml, side: 'home', team: r.home_team });
      const adjAway = adjustedEdge({ edge: edgeAway, ml: r.away_market_ml, side: 'away', team: r.away_team });

      // Confidence (0..10)
      const confHome = confFromEdge(adjHome);
      const confAway = confFromEdge(adjAway);

      // choose side by higher confidence, not just model prob
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
        confidence,                // DERIVED confidence
        moneyline,
        stake,
        to_win     : 100
      };
    })
    // final: only keep ≥7 confidence
    .filter(b => b.confidence >= 7.0);

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
