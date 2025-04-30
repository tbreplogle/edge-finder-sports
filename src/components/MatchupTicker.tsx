
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

        /* ---- bucket Yesterday / Today / Tomorrow ---- */
        const todayISO = new Date().toISOString().slice(0, 10);
        const yesterdayISO = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
        const tomorrowISO  = new Date(Date.now() + 864e5).toISOString().slice(0, 10);

        const buckets: Record<string, typeof games> = {
          Yesterday: [],
          Today: [],
          Tomorrow: []
        };

        games.forEach(g => {
          const d = g.commence_time.slice(0, 10);
          if (d === todayISO) buckets.Today.push(g);
          else if (d === yesterdayISO) buckets.Yesterday.push(g);
          else if (d === tomorrowISO) buckets.Tomorrow.push(g);
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
