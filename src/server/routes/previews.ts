import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

function edgeOf(row: any) {
  const nums = [
    row.edge,
    row.edge_pct,
    row.home_edge_pct, row.away_edge_pct,
    row.home_edge, row.away_edge,
  ].filter((n) => typeof n === 'number');
  return nums.length ? Math.max(...nums.map(Math.abs)) : 0;
}
function tag(rows: any[], sport: string) {
  return rows.map((r) => ({ ...r, sport, _e: edgeOf(r) }));
}

router.get('/all', async (_req, res) => {
  try {
    const [mlb, nfl, cbk, ncaaf] = await Promise.all([
      db.from('mlb_predictions_with_market').select(),
      db.from('nfl_predictions_with_market').select(),
      db.from('cbk_predictions_with_market').select(),
      db.from('ncaaf_predictions_with_market').select(),
    ]);

    const combined = [
      ...tag(mlb.data || [], 'MLB'),
      ...tag(nfl.data || [], 'NFL'),
      ...tag(cbk.data || [], 'CBK'),
      ...tag(ncaaf.data || [], 'NCAAF'),
    ];

    combined.sort((a, b) => (b._e ?? 0) - (a._e ?? 0));
    const bestBet = combined[0] || null;

    res.json({ bestBet, previews: combined.map(({ _e, ...rest }) => rest) });
  } catch (e: any) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
