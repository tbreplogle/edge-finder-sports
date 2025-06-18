/* lockDailyBets.js  –  Kelly-sized stakes   */
import { supabase, testConnection } from './lib/supabaseClient.js';

/* ─── parameters you may tune ────────────────────────────────────────── */
const START_BANK = 1000;   // bankroll before first wager ever recorded
const CAP_FRAC   = 0.02;   // never risk > 2 % of current bankroll
const KELLY_FRACTION = 0.5; // 0.5 = “half-Kelly”
const MIN_CONF   = 7;      // only lock bets with confidence ≥ 7
/* ────────────────────────────────────────────────────────────────────── */

/* 1 → 10 confidence  →  win-probability p  (edit to suit your data) */
function confToProb(conf) {
  if (conf < 7.5) return 0.45;
  if (conf < 8.0) return 0.48;
  if (conf < 8.5) return 0.53;
  if (conf < 9.0) return 0.57;
  return 0.60;
}

function todayCT() {
  const ct = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
  );
  return ct.toISOString().slice(0, 10);
}

/* convert American ML → decimal odds */
function toDecimalOdds(ml) {
  return ml > 0 ? 1 + ml / 100 : 1 + 100 / Math.abs(ml);
}

async function currentBankroll() {
  const { data, error } = await supabase
    .from('mlb_daily_results')
    .select('profit_loss');
  if (error) throw error;
  const pnl = data.reduce((sum, r) => sum + Number(r.profit_loss || 0), 0);
  return START_BANK + pnl;
}

async function lockDailyBets() {
  if (!(await testConnection())) throw new Error('DB connection failed');

  const today = todayCT();
  const bank  = await currentBankroll();

  /* 1️⃣  fetch predictions with market lines */
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

  /* 2️⃣  meta for team IDs */
  const { data: metas, error: metaErr } = await supabase
    .from('mlb_matchups')
    .select('matchup_id, home_team_id, away_team_id')
    .eq('game_date', today);
  if (metaErr) throw metaErr;
  const metaById = Object.fromEntries(metas.map(m => [m.matchup_id, m]));

  /* 3️⃣  build Kelly-sized bets */
  const bets = preds.flatMap(r => {
    const bestConf = Math.max(r.home_confidence ?? 0, r.away_confidence ?? 0);
    if (bestConf < MIN_CONF) return [];
    if (r.home_market_ml == null || r.away_market_ml == null) return [];
    const meta = metaById[r.matchup_id];
    if (!meta) return [];

    const betHome  = (r.home_confidence ?? 0) >= (r.away_confidence ?? 0);
    const moneyline = betHome ? r.home_market_ml : r.away_market_ml;
    const team_id   = betHome ? meta.home_team_id : meta.away_team_id;
    const team_name = betHome ? r.home_team       : r.away_team;

    /* Kelly stake */
    const p    = confToProb(bestConf);
    const dec  = toDecimalOdds(moneyline);
    const b    = dec - 1;
    const fStar= (p * b - (1 - p)) / b;           // full-Kelly fraction
    const fAdj = KELLY_FRACTION * fStar;          // half-Kelly
    const stakeFrac = Math.min(Math.max(0, fAdj), CAP_FRAC);
    if (stakeFrac === 0) return [];               // skip negative edge

    const stake = +(stakeFrac * bank).toFixed(2);
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

  const { error: upErr } = await supabase
    .from('mlb_daily_bets')
    .upsert(bets, { onConflict: 'matchup_id' });

  if (upErr) throw upErr;
  console.log('✅ Bets locked.');
}

/* CLI */
if (import.meta.url.endsWith('lockDailyBets.js')) {
  lockDailyBets()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}