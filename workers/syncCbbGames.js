// workers/syncCbbGames.js
// -----------------------
// Fetch season games from CollegeBasketballData and upsert into cbb.games

try {
    const { config } = await import('dotenv');
    config();
  } catch {
    console.log('dotenv not installed – skipping .env load');
  }
  
  import fetch from 'node-fetch';
  import { createClient } from '@supabase/supabase-js';
  
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CFBD_API_KEY } = process.env;
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CFBD_API_KEY) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / CFBD_API_KEY');
    process.exit(1);
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    db: { schema: 'cbb' },
  });
  
  const pick = (obj, keys) => {
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return null;
  };
  
  async function run(seasonArg) {
    const season = seasonArg ? Number(seasonArg) : new Date().getFullYear();
    console.log(`Syncing CBB games for season ${season}...`);
  
    const url = new URL('https://api.collegebasketballdata.com/games');
    url.searchParams.set('year', season);
  
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${CFBD_API_KEY}` },
    });
  
    if (!res.ok) {
      throw new Error(`CBB /games ${res.status}: ${await res.text()}`);
    }
  
    const games = await res.json();
    console.log(`Got ${games.length} games from API`);
  
    const nowIso = new Date().toISOString();
  
    const rows = games.map((g) => {
      const game_id = pick(g, ['id', 'gameId']);
      const seasonVal = pick(g, ['season', 'year']) ?? season;
      const season_type = pick(g, ['seasonType', 'season_type']);
      const startDateRaw = pick(g, ['startDate', 'start_date']);
      const neutral_site = pick(g, ['neutralSite', 'neutral_site']);
      const conference_game = pick(g, ['conferenceGame', 'conference_game']);
      const game_type = pick(g, ['gameType', 'game_type']);
      const tournament = pick(g, ['tournament']);
      const home_team_id = pick(g, ['homeTeamId', 'home_team_id']);
      const home_team = pick(g, ['homeTeam', 'home_team']);
      const away_team_id = pick(g, ['awayTeamId', 'away_team_id']);
      const away_team = pick(g, ['awayTeam', 'away_team']);
      const home_points = pick(g, ['homePoints', 'home_points']);
      const away_points = pick(g, ['awayPoints', 'away_points']);
      const home_winner = pick(g, ['homeWinner', 'home_winner']);
      const away_winner = pick(g, ['awayWinner', 'away_winner']);
  
      if (!game_id) {
        console.warn('Skipping game with no id:', g);
        return null;
      }
  
      const start_date = startDateRaw ? startDateRaw.slice(0, 10) : null;
  
      return {
        game_id,
        season: seasonVal,
        season_type,
        start_date,
        start_time: startDateRaw ?? null,
        neutral_site: neutral_site ?? null,
        conference_game: conference_game ?? null,
        game_type,
        tournament,
        home_team_id,
        home_team,
        away_team_id,
        away_team,
        home_points,
        away_points,
        home_winner,
        away_winner,
        data: g,
        updated_at: nowIso,
      };
    }).filter(Boolean);
  
    if (!rows.length) {
      console.log('Nothing to upsert.');
      return;
    }
  
    const { error, count } = await supabase
      .from('games')
      .upsert(rows, {
        onConflict: 'game_id',
        ignoreDuplicates: false,
        count: 'exact',
      });
  
    if (error) throw error;
    console.log(`✅ Upserted ${count} rows into cbb.games.`);
  }
  
  if (import.meta.url === `file://${process.argv[1]}`) {
    run(process.argv[2]).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  }
  