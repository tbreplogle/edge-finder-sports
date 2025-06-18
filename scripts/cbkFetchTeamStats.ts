// Scrape Torvik stats & rolling margin into cbk.team_daily (snapshot per team)
import { createClient } from '@supabase/supabase-js';

const argDate  = process.argv.find(a => a.startsWith('--date='))?.split('=')[1];
const RUN_DATE = argDate ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const sb       = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/* ── Torvik CSV pull ───────────────────────── */
async function getTorvik(date: string) {
  const txt = await fetch(`https://barttorvik.com/trank.php?date=${date}&csv=1`).then(r => r.text());
  const rows = txt.trim().split('\n').slice(1);
  const m: Record<number, any> = {};
  for (const r of rows) {
    const c = r.split(',');
    const id = Number(c[0]);
    m[id] = {
      torvik_em: +c[7], off_eff: +c[8], def_eff: +c[9],
      efg_off: +c[17], efg_def: +c[18],
      tov_off: +c[19], tov_def: +c[20],
      orb_off: +c[21], orb_def: +c[22],
      ftr_off: +c[23], ftr_def: +c[24],
      pace: +c[13]
    };
  }
  return m;
}

const torvik = await getTorvik(RUN_DATE);

/* rolling last-5 margin */
const rolls = await sb.rpc('get_last5_margins', { p_date: RUN_DATE });
const rollMap = Object.fromEntries(rolls.data!.map((x:any)=>[x.team_id,x.avg_margin]));

for (const [idStr, stats] of Object.entries(torvik)) {
  await sb.from('cbk.team_daily').upsert({
    team_id: Number(idStr),
    date: RUN_DATE,
    ...stats,
    margin_last5: rollMap[idStr] ?? null
  }, { onConflict: 'team_id,date' });
}

console.log(`✓ cbk.team_daily Torvik snapshot stored for ${RUN_DATE}`);
