import { RandomForestRegression as RF } from 'ml-random-forest';
import { createClient } from '@supabase/supabase-js';

// ---- cmd-arg helper ------------------------------------------------
const argDate = process.argv.find(a => a.startsWith('--date='))?.split('=')[1];
const PRED_DATE = argDate ?? new Date().toISOString().slice(0, 10);
// --------------------------------------------------------------------

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ───────────── 1) load latest model ────────────────────────────────
const meta = (await sb
  .from('cbk.models')
  .select('*')
  .eq('algo', 'rf_js')
  .order('trained_at', { ascending: false })
  .limit(1)
).data![0];

const { data: blob, error: dlErr } = await sb
  .storage
  .from('model-artifacts')
  .download(meta.artifact_url);

if (dlErr || !blob) throw dlErr ?? new Error('model download failed');

const rf = RF.load(JSON.parse(await blob.text()));

// ───────────── 2) games for pred-date ───────────────────────────────
const { data: games } = await sb
  .from('cbk.games')
  .select('*')
  .eq('date', PRED_DATE);

if (!games?.length) {
  console.log('no games for', PRED_DATE);
  process.exit(0);
}

// helper to pull latest snapshot for a team up to PRED_DATE
async function snap(team: number) {
  return (
    await sb
      .from('cbk.team_daily')
      .select('*')
      .eq('team_id', team)
      .lte('date', PRED_DATE)
      .order('date', { ascending: false })
      .limit(1)
  ).data![0];
}

// explicit interface so preds is NOT never[]
interface Prediction {
  game_id: number;
  run_ts: string;
  pred_margin: number;
  win_prob_home: number;
  model_id: string;
}
const preds: Prediction[] = [];

// build features & predict
for (const g of games) {
  const h = await snap(g.home_team_id);
  const a = await snap(g.away_team_id);

  const feat = [
    h.elo - a.elo,
    h.torvik_em - a.torvik_em,
    h.off_eff - a.off_eff,
    a.def_eff - h.def_eff,
    h.efg_off - a.efg_off,
    h.tov_off - a.tov_off,
    h.orb_off - a.orb_off,
    h.ftr_off - a.ftr_off,
    (h.pace + a.pace) / 2,
    h.margin_last5 - a.margin_last5,
    h.sos_win50 - a.sos_win50,
    g.location === 'home' ? 1 : g.location === 'away' ? -1 : 0
  ];

  const margin = rf.predict([feat])[0];
  const winProb = 1 / (1 + Math.exp(-margin / 6.5));

  preds.push({
    game_id: g.game_id,
    run_ts: new Date().toISOString(),
    pred_margin: +margin.toFixed(2),
    win_prob_home: +winProb.toFixed(3),
    model_id: meta.model_id
  });
}

// ───────────── 3) upsert predictions ────────────────────────────────
await sb.from('cbk.predictions').upsert(preds);
console.log(`✓ inserted ${preds.length} predictions for ${PRED_DATE}`);
