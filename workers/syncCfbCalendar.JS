// workers/syncCfbCalendar.js
// ────────────────────────────────────────────────────────────────
// Fetch CollegeFootballData calendar and upsert into Supabase.
// By default syncs the *current* year; override with CLI arg.
//
// Usage (local):
//   node syncCfbCalendar.js [year]
// ────────────────────────────────────────────────────────────────
//
try {
    const { config } = await import('dotenv');
    config();
  } catch { /* no dotenv on CI – fine */ }
  
  import fetch from 'node-fetch';
  import { createClient } from '@supabase/supabase-js';
  
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CFBD_API_KEY } = process.env;
  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false }, db: { schema: 'cfb' } }
  );
  
  const targetSeason = Number(process.argv[2]) || new Date().getFullYear();
  
  async function run() {
    const url = `https://api.collegefootballdata.com/calendar?year=${targetSeason}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${CFBD_API_KEY}` } });
    if (!res.ok) throw new Error(`CFBD ${res.status}: ${await res.text()}`);
    const cal = await res.json();      // array of weeks
  
    const rows = cal.map(w => ({
      season:       w.season,
      week:         w.week,
      season_type:  w.seasonType,
      start_date:   w.startDate,
      end_date:     w.endDate,
      updated_at:   new Date().toISOString()
    }));
  
    const { error, count } = await supabase
      .from('season_calendar')
      .upsert(rows, { ignoreDuplicates: false, count: 'exact' });
  
    if (error) throw error;
    console.log(`✅ Upserted ${count} calendar rows for ${targetSeason}`);
  }
  
  if (import.meta.url === `file://${process.argv[1]}`) {
    run().catch(err => { console.error(err); process.exit(1); });
  }
  