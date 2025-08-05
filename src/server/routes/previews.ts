import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Helper to extract edge from row
function extractEdge(row: any): number {
  const candidates: number[] = [];
  const fields = [
    row.edge,
    row.edge_pct,
    row.home_edge_pct,
    row.away_edge_pct,
    row.home_edge,
    row.away_edge,
  ];
  for (const v of fields) {
    if (typeof v === 'number') {
      candidates.push(Math.abs(v));
    }
  }
  if (candidates.length === 0) return 0;
  return Math.max(...candidates);
}

function tagSport(rows: any[] | null, sport: string) {
  return (rows || []).map((r: any) => ({
    ...r,
    sport,
    _edge_score: extractEdge(r),
  }));
}

// GET /api/previews/all
router.get('/all', async (_req, res) => {
  try {
    const [mlb, nfl, cbk, ncaaf] = await Promise.all([
      supabase.from('mlb_predictions_with_market').select(),
      supabase.from('nfl_predictions_with_market').select(),
      supabase.from('cbk_predictions_with_market').select(),
      supabase.from('ncaaf_predictions_with_market').select(),
    ]);

    const combined = [
      ...tagSport(mlb.data, 'MLB'),
      ...tagSport(nfl.data, 'NFL'),
      ...tagSport(cbk.data, 'CBK'),
      ...tagSport(ncaaf.data, 'NCAAF'),
    ];

    combined.sort((a: any, b: any) => (b._edge_score ?? 0) - (a._edge_score ?? 0));
    const bestBet = combined[0] || null;

    return res.json({
      bestBet,
      previews: combined.map(({ _edge_score, ...rest }: any) => rest),
    });
  } catch (error) {
    console.error('Error fetching previews:', error);
    return res.status(500).json({ error: 'Error fetching previews' });
  }
});

export default router;
