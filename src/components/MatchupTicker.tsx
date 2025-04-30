
import { useState, useEffect } from 'react';
import { SportSelector } from './ticker/SportSelector';
import { TickerContent } from './ticker/TickerContent';
import {
  fetchOdds,
  convertToTickerGames,
  SPORT_KEYS
} from '@/utils/oddsApi';
import { DEFAULT_SPORT } from '@/utils/config/sportKeys';
import { TickerData } from '@/utils/types/sports';
import { formatInTimeZone } from 'date-fns-tz';

export function MatchupTicker() {
  const [sport, setSport] = useState<keyof typeof SPORT_KEYS>(DEFAULT_SPORT);
  const [data, setData] = useState<TickerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noGames, setNoGames] = useState(false);

  /* ========== fetch when sport changes ========== */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setNoGames(false);

      const sportKey = SPORT_KEYS[sport];
      console.log('[Ticker] fetching', sportKey);

      try {
        const games = await fetchOdds(sportKey);
        console.log('[Ticker] rows:', games.length);

        if (cancelled) return;

        if (games.length === 0) {
          setNoGames(true);
          setData(null);
          return;
        }

        /* ---- bucket Yesterday / Today / Tomorrow using Chicago time zone ---- */
        const timeZone = 'America/Chicago';
        
        // Get today's date in Chicago time zone (YYYY-MM-DD format)
        const todayChicago = formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd');
        
        // Calculate yesterday and tomorrow in Chicago time zone
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayChicago = formatInTimeZone(yesterday, timeZone, 'yyyy-MM-dd');
        
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowChicago = formatInTimeZone(tomorrow, timeZone, 'yyyy-MM-dd');

        const buckets: Record<string, typeof games> = {
          Yesterday: [],
          Today: [],
          Tomorrow: []
        };

        games.forEach(g => {
          // Convert game commence time to Chicago time zone date string
          const gameDate = formatInTimeZone(new Date(g.commence_time), timeZone, 'yyyy-MM-dd');
          
          if (gameDate === todayChicago) buckets.Today.push(g);
          else if (gameDate === yesterdayChicago) buckets.Yesterday.push(g);
          else if (gameDate === tomorrowChicago) buckets.Tomorrow.push(g);
        });

        const days = (['Yesterday', 'Today', 'Tomorrow'] as const)
          .filter(l => buckets[l].length)
          .map(label => ({
            label,
            date: label,
            games: convertToTickerGames(buckets[label], sportKey)
          }));

        setData({ sport, days });
      } catch (err) {
        console.error('[Ticker] fetch failed', err);
        setNoGames(true);
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sport]);

  /* ========== UI ========== */
  if (loading)
    return (
      <div className="w-full bg-muted/20 h-12 flex items-center justify-center">
        <p className="text-xs text-muted-foreground">Loading matchup data…</p>
      </div>
    );

  return (
    <div className="w-full bg-muted/20 border-b overflow-hidden">
      <div className="container py-2">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium">Match-ups</h3>
          <SportSelector 
            selectedSport={sport} 
            onSportChange={(value) => setSport(value as keyof typeof SPORT_KEYS)} 
          />
        </div>

        {noGames ? (
          <div className="flex items-center justify-center p-2 bg-card
                          border border-border/30 rounded-md">
            <p className="text-sm text-muted-foreground">No games scheduled</p>
          </div>
        ) : (
          data && <TickerContent data={data} />
        )}
      </div>
    </div>
  );
}
