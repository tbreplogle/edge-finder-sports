// workers/syncCbbGameLines.js
// ----------------------------------------------
// Pull CBB betting lines and upsert into cbb.game_lines.
// ----------------------------------------------

try {
    const { config } = await import('dotenv');
    config();
  } catch {
    console.log('dotenv not installed – skipping .env load');
  }
  
  import fetch from 'node-fetch';
  import { createClient } from '@supabase/supabase-js';
  
  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    CFBD_API_KEY, // same key works for CBBD
  } = process.env;
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CFBD_API_KEY) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / CFBD_API_KEY');
    process.exit(1);
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    db:   { schema: 'cbb' },
  });
  
  async function run(season) {
    console.log(`🔄 Syncing CBB lines for season ${season}...`);
  
    const url =
      `https://api.collegebasketballdata.com/lines` +
      `?season=${season}`; // add start/end date, provider filters if needed
  
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${CFBD_API_KEY}`,
      },
    });
  
    if (!res.ok) {
      throw new Error(`CBBD /lines ${res.status}: ${await res.text()}`);
    }
  
    const lines = await res.json();
  
    const rows = lines.flatMap(l => {
      if (!l.gameId) {
        console.warn('⚠️ Missing gameId on line object – skipping', l);
        return [];
      }
  
      const spread       = l.spread ?? null;
      const spreadOpen   = l.spreadOpen ?? null;
      const total        = l.overUnder ?? null;
      const totalOpen    = l.overUnderOpen ?? null;
      const homeML       = l.homeMoneyline ?? null;
      const awayML       = l.awayMoneyline ?? null;
      const provider     = l.provider ?? 'unknown';
  
      return {
        game_id:         l.gameId,
        season:          l.season ?? season,
        provider:        provider,
        spread:          spread,
        spread_open:     spreadOpen,
        over_under:      total,
        over_under_open: totalOpen,
        home_moneyline:  homeML,
        away_moneyline:  awayML,
        updated_at:      new Date().toISOString(),
      };
    });
  
    if (!rows.length) {
      console.log('No lines to upsert.');
      return;
    }
  
    console.log('Sample line row:', rows[0]);
  
    // OPTIONAL BUT RECOMMENDED: filter to only games that exist in cbb.games
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id');
  
    if (gamesError) {
      throw gamesError;
    }
  
    const validGameIds = new Set(games.map(g => g.id));
    const filteredRows = rows.filter(r => validGameIds.has(r.game_id));
  
    console.log(
      `Prepared ${rows.length} rows, ${filteredRows.length} match existing games, ${
        rows.length - filteredRows.length
      } skipped due to missing game_id in cbb.games`
    );
  
    if (!filteredRows.length) {
      console.log('Nothing to upsert after filtering for valid game_ids.');
      return;
    }
  
    const { error, count } = await supabase
      .from('game_lines')
      .upsert(filteredRows, { ignoreDuplicates: false, count: 'exact' });
  
    if (error) throw error;
    console.log(`✅ Upserted ${count} rows into cbb.game_lines.`);
  }
  
  // CLI guard
if (import.meta.url === `file://${process.argv[1]}`) {
    // read season from CLI: node syncCbbGameLines.js 2026
    const seasonArg = process.argv[2];
    let season = Number(seasonArg);
  
    if (!seasonArg || Number.isNaN(season)) {
      console.warn(
        `⚠️ No valid season CLI arg provided, defaulting to 2026 (got: "${seasonArg}")`
      );
      season = 2026;
    }
  
    run(season).catch(err => {
      console.error(err);
      process.exit(1);
    });
  }
  