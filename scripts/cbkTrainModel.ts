/* Train Random-Forest regressor + upload */
import { RandomForestRegression as RF } from 'ml-random-forest';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const rows = (await sb.from('cbk.games_features_view').select('*')).data!;
const X = rows.map(r => [
  r.elo_diff, r.torvik_em_diff, r.off_eff_diff, r.def_eff_diff,
  r.efg_off_diff, r.tov_off_diff, r.orb_off_diff, r.ftr_off_diff,
  r.pace_mean, r.margin_last5_diff, r.sos_win50_diff, r.home_flag
]);
const y = rows.map(r => r.actual_margin);

const opts = { seed:42, maxFeatures:0.8, nEstimators:300,
               treeOptions:{minNumSamples:20,maxDepth:7}};
const rf = new RF(opts); rf.train(X,y);

const out = `models/cbk_margin_rf_${Date.now()}.json`;
const json = JSON.stringify(rf.toJSON()); writeFileSync(out, json);

await sb.storage.from('model-artifacts').upload(out, json, { upsert:true });
await sb.from('cbk.models').insert({
  algo:'rf_js', trained_at:new Date().toISOString(),
  params:opts, artifact_url:out });
console.log('✓ model stored', out);
