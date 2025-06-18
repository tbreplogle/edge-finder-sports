/* lockDailyBets.js  –  Kelly or flat-100 stakes
   ---------------------------------------------------------------
   • Positive edge  →  stake = min(½-Kelly , 15 % bank , $150)
   • Non-positive   →  stake = min(flat-win-100 , $150)
*/

import { supabase, testConnection } from './lib/supabaseClient.js';

/* ───────────── parameters ───────────── */
const START_BANK      = 1000;   // initial bankroll if table were empty
const CAP_FRAC        = 0.15;   // never risk > 15 % of current bank
const MAX_STAKE       = 150;    // hard dollar ceiling
const KELLY_FRACTION  = 0.5;    // ½-Kelly
const MIN_CONF        = 7;      // minimum confidence to bet
/* ───────────────────────────────────────*/

/* confidence (1-10) → win-probability p  – adjust to your calibration */
function confToProb(c) {
  if (c < 7.5) return 0.45;
  if (c < 8.0) return 0.48;
  if (c < 8.5) return 0.53;
  if (c < 9.0) return 0.57;
  return 0.60;
}

/* ML → decimal odds */
const decOdds = ml => (ml > 0 ? 1 + ml / 100 : 1 + 100 / Math.abs(ml));

/* ML → stake needed to win exactly 100 (old flat rule) */
function stakeForWin100(ml) {
  return ml < 0 ? Math.abs(ml) : +(10000 / ml).toFixed(2);
}

/* today in Chicago */
function todayCT() {
  const d = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
  );
  return d.toISOString().slice(0, 10);
}

/* bankroll = start + realised P/L */
async function currentBankroll() {
  const { data, error } = await supabase
    .from('mlb_daily_results')
    .select('profit_loss');
  if (error) throw error;
  const pnl = data.reduce((s, r) => s + Number(r.profit_loss || 0), 0);
  return START_BANK + pnl;
}

async function lockDailyBets() {
  if (!(await testConnection())) throw new Error('DB connection failed');
  const today = todayCT();
  const bank  = await currentBankroll();

  /* 1️⃣  predictions + market ML */
  const { data: preds } = await supabase
    .from('mlb_predictions_with_market')
    .select(`
        matchup_id, game_time_ct,
        home_confidence, away_confidence,
        home_market_ml,  away_market_ml,
        home_team,       away_team
    `)
    .gte('game_time_ct', `${today}T00:00:00-05:00`)
    .lt ('game_time_ct', `${today}T23:59:59-05:00`);

  /* 2️⃣ meta for team IDs */
  const { data: metas } = await supabase
    .from('mlb_matchups')
    .select('matchup_id, home_team_id, away_team_id')
    .eq('game_date', today);
  const metaById = Object.fromEntries(metas.map(m => [m.matchup_id, m]));

  /* 3️⃣ build bet rows */
  const bets = preds.flatMap(r => {
    const bestConf = Math.max(r.home_confidence ?? 0, r.away_confidence ?? 0);
    if (bestConf < MIN_CONF) return [];                  // below threshold
    if (r.home_market_ml == null || r.away_market_ml == null) return [];
    const meta = metaById[r.matchup_id];
    if (!meta) return [];

    const betHome  = (r.home_confidence ?? 0) >= (r.away_confidence ?? 0);
    const moneyline = betHome ? r.home_market_ml : r.away_market_ml;
    const team_id   = betHome ? meta.home_team_id : meta.away_team_id;
    const team_name = betHome ? r.home_team       : r.away_team;

    /* ---------- stake calculation ---------- */
    const p   = confToProb(bestConf);
    const dec = decOdds(moneyline);
    const b   = dec - 1;
    const fStar = (p * b - (1 - p)) / b;        // raw Kelly
    const fAdj  = KELLY_FRACTION * fStar;       // half-Kelly

    let stake;
    if (fAdj > 0) {
      stake = fAdj * bank;                      // positive edge
    } else {
      stake = stakeForWin100(moneyline);        // fallback flat stake
    }
    stake = Math.min(stake, CAP_FRAC * bank, MAX_STAKE);
    stake = +stake.toFixed(2);
    if (stake < 1) stake = 1;                   // minimum $1 action

    const toWin = +(stake * (dec - 1)).toFixed(2);

    return [{
      matchup_id : r.matchup_id,
      game_date  : today,
      team_id,
      team_name,
      confidence : bestConf,
      moneyline,
      stake,
      to_win     : toWin
    }];
  });

  console.log(`Locking ${bets.length} bets for ${today}`);

  if (!bets.length) return;

  const { error } = await supabase
    .from('mlb_daily_bets')
    .upsert(bets, { onConflict: 'matchup_id' });

  if (error) throw error;
  console.log('✅ Bets locked.');
}

/* CLI */
if (import.meta.url.endsWith('lockDailyBets.js')) {
  lockDailyBets()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
