// Update Elo snapshot for RUN_DATE (after results)
import { createClient } from '@supabase/supabase-js';

const K = 20, HOME_ADV = 70;
const argDate  = process.argv.find(a => a.startsWith('--date='))?.split('=')[1];
const RUN_DATE = argDate ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const games = (await sb.from('cbk.games').select('*').eq('date', RUN_DATE)).data!;
for (const g of games) {
  const eloHome = await latest(g.home_team_id);
  const eloAway = await latest(g.away_team_id);

  const adjHome = eloHome + (g.location==='home'?HOME_ADV:0);
  const adjAway = eloAway + (g.location==='away'?HOME_ADV:0);
  const pHome   = 1/(1+10**((adjAway-adjHome)/400));
  const margin  = Math.abs(g.home_score - g.away_score);
  const movMul  = Math.min(1, Math.log(margin+1)*2/3);
  const delta   = K*movMul*((g.home_score>g.away_score?1:0)-pHome);

  await upsert(g.home_team_id, eloHome+delta);
  await upsert(g.away_team_id, eloAway-delta);
}

async function latest(t:number){
  const d = await sb.from('cbk.team_daily')
    .select('elo').eq('team_id',t).lte('date',RUN_DATE)
    .order('date',{ascending:false}).limit(1);
  return d.data![0]?.elo ?? 1500;
}
async function upsert(team:number, elo:number){
  await sb.from('cbk.team_daily').upsert({team_id:team,date:RUN_DATE,elo},
                                         { onConflict:'team_id,date' });
}

console.log(`✓ Elo updated for ${RUN_DATE}`);
