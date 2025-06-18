// Fetch yesterday’s (or --date=YYYY-MM-DD) box-score headers into cbk.games
import { createClient } from '@supabase/supabase-js';

const API_KEY = process.env.CBKD_API_KEY!;
const argDate  = process.argv.find(a => a.startsWith('--date='))?.split('=')[1];
const RUN_DATE = argDate ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const url = `https://api.collegebasketballdata.com/games?date=${RUN_DATE}`;
const resp = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` }});
const games = await resp.json();

for (const g of games) {
  await sb.from('cbk.games').upsert({
    game_id: g.id,
    season:  Number(g.season),
    date:    RUN_DATE,
    home_team_id: g.home.teamId,
    away_team_id: g.away.teamId,
    home_score:   g.home.score,
    away_score:   g.away.score,
    location:     g.venue.isNeutral ? 'neutral'
                 : g.home.teamId ? 'home' : 'away'
  }, { onConflict: 'game_id' });
}

console.log(`✓ cbk.games upserted ${games.length} rows for ${RUN_DATE}`);
