/*  lockDailyBets.js  –  Kelly-sized stakes with cap + hard ceiling
    ----------------------------------------------------------------
    • Locks every prediction whose confidence ≥ MIN_CONF
    • Stake = ½-Kelly fraction of bankroll, but no more than
        - CAP_FRAC × bankroll   (perc-cap)   and
        - MAX_STAKE             (hard-dollar cap)
    • Bets with negative edge (Kelly ≤ 0) are skipped
*/

import { supabase, testConnection } from './lib/supabaseClient.js';

/* ─── parameters you may tune ──────────────────────────────────── */
const START_BANK      = 1000;   // initial bankroll before first wager
const CAP_FRAC        = 0.15;   // max % of bankroll to risk (15 % ⇒ ≈$150 on 1 000)
const MAX_STAKE       = 150;    // absolute dollar ceiling per bet
const KELLY_FRACTION  = 0.5;    // 0.5 = “half-Kelly”
const MIN_CONF        = 7.0;    // lock only when confidence ≥ 7
/* ─────────────────────────────────────────────────────────────── */

/* confidence (1-10) → win-probability p  – change buckets to your calibration */
function confToProb(conf) {
  if (conf < 7.5) return 0.45;
  if (conf < 8.0) return 0.48;
  if (conf < 8.5) return 0.53;
  if (conf < 9.0) return 0.57;
  return 0.60;
}

/* American ML → decimal odds */
function toDecimalOdds(ml) {
  return ml > 0 ? 1 + ml / 100 : 1 + 100 / Math.abs(ml);
}

/* YYYY-MM-DD in Central Time */
function todayCT() {
  const ct = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
  );
  return ct.toISOString().slice(0, 10);
}

/* bankroll = START_BANK + Σ(profit_loss) */
async function currentBankroll() {
  const { data, error } = await supabase
    .from('mlb_daily_results')
    .select('profit_loss');
  if (error) throw error;
  const pnl = data?.reduce((s, r) => s + Number(r.profit_loss || 0), 0) || 0;
  return START_BANK + pnl;
}

/* MAIN ******************************************************************** */
async function lockDailyBets() {
  if (!(await testConnection())) throw new Error('DB connection failed');

  const today   = todayCT();
  const bank    = await currentBankroll();

  /* 1️⃣  predictions for today – include market MLs & team names */
  const { data: preds, error: predErr } = await supabase
    .from('mlb_predictions_with_market')
    .select(`
      matchup_id,
      game_time_ct,
      home_confidence,
      away_confidence,
      home_market_ml,
      away_market_ml,
      home_team,
      away_team
    `)
    .gte('game_time_ct', `${today}T00:00:00-05:00`)
    .lt ('game_time_ct', `${today}T23:59:59-05:00`);
  if (predErr) throw predErr;

  /* 2️⃣  team-ID meta */
  const { data: metas, error: metaErr } = await supabase
    .from('mlb_matchups')
    .select('matchup_id, home_team_id, away_team_id')
    .eq('game_date', today);
  if (metaErr) throw metaErr;

  const metaById = Object.fromEntries(metas.map(m => [m.matchup_id, m]));

  /* 3️⃣  build Kelly-sized wagers */
  const bets = preds.flatMap(r => {
    const bestConf = Math.max(r.home_confidence ?? 0, r.away_confidence ?? 0);
    if (bestConf < MIN_CONF) return [];                     // below threshold
    if (r.home_market_ml == null || r.away_market_ml == null) return [];

    const meta = metaById[r.matchup_id];
    if (!meta) return [];

    const betHome   = (r.home_confidence ?? 0) >= (r.away_confidence ?? 0);
    const moneyline = betHome ? r.home_market_ml : r.away_market_ml;
    const team_id   = betHome ? meta.home_team_id : meta.away_team_id;
    const team_name = betHome ? r.home_team       : r.away_team;

    /* Kelly math */
    const p       = confToProb(bestConf);
    const dec     = toDecimalOdds(moneyline);
    const b       = dec - 1;
    const fStar   = (p * b - (1 - p)) / b;          // full Kelly fraction
    const fAdj    = KELLY_FRACTION * fStar;         // half-Kelly

    const rawStake = fAdj * bank;
    const stake = +Math.min(
      MAX_STAKE,
      CAP_FRAC * bank,
      Math.max(0, rawStake)                         // 0 if edge ≤ 0
    ).toFixed(2);

    if (stake === 0) return [];                     // skip negative-edge bet

    const toWin = +(stake * b).toFixed(2);

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

  const { error: upErr } = await supabase
    .from('mlb_daily_bets')
    .upsert(bets, { onConflict: 'matchup_id' });

  if (upErr) throw upErr;
  console.log('✅ Bets locked.');
}

/* CLI entry *****************************************************************/
if (import.meta.url.endsWith('lockDailyBets.js')) {
  lockDailyBets()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
