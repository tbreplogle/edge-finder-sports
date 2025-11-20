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
  
  async function run(season = 2025) {
    // TODO: confirm the exact endpoint + params from CBBD docs.
    // CFBD-style football endpoint is /betting/lines; CBBD will have an analogous one.
    const url =
      `https://api.collegebasketballdata.com/lines` +
      `?year=${season}`; // add start/end date, provider filters if needed
  
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${CFBD_API_KEY}`,
      },
    });
  
    if (!res.ok) {
      throw new Error(`CBBD /lines ${res.status}: ${await res.text()}`);
    }
  
    const lines = await res.json();
  
    // lines is typically an array with game_id, team names, provider, spread, over_under, etc.
    const rows = lines.flatMap(l => {
      if (!l.gameId) {
        console.warn('⚠️ Missing gameId on line object – skipping', l);
        return [];
      }
  
      // Adjust these property names to match actual CBBD response:
      const spread      = l.spread ?? null;
      const spreadOpen  = l.spreadOpen ?? null;
      const total       = l.overUnder ?? null;
      const totalOpen   = l.overUnderOpen ?? null;
      const homeML      = l.homeMoneyline ?? null;
      const awayML      = l.awayMoneyline ?? null;
      const provider    = l.provider ?? 'unknown';
  
      return {
        game_id:        l.gameId,
        season:         l.season,
        provider:       provider,
        spread:         spread,
        spread_open:    spreadOpen,
        over_under:     total,
        over_under_open: totalOpen,
        home_moneyline: homeML,
        away_moneyline: awayML,
        updated_at:     new Date().toISOString(),
      };
    });
  
    if (!rows.length) {
      console.log('No lines to upsert.');
      return;
    }
  
    console.log('Sample line row:', rows[0]);
  
    const { error, count } = await supabase
      .from('game_lines')
      .upsert(rows, { ignoreDuplicates: false, count: 'exact' });
  
    if (error) throw error;
    console.log(`✅ Upserted ${count} rows into cbb.game_lines.`);
  }
  
  // CLI guard
  if (import.meta.url === `file://${process.argv[1]}`) {
    run().catch(err => {
      console.error(err);
      process.exit(1);
    });
  }
  