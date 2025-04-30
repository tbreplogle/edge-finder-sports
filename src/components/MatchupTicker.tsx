// -------------- MatchupTicker.tsx --------------
import { useState, useEffect } from 'react';
import { SportSelector } from './ticker/SportSelector';
import { TickerContent } from './ticker/TickerContent';
import {
  fetchOdds,
  SPORT_KEYS,
  convertToTickerGames,
  DEFAULT_SPORT,
  TickerData
} from '@/utils/oddsApi';

export function MatchupTicker() {
  const [sport, setSport] = useState(DEFAULT_SPORT);
  const [data, setData] = useState<TickerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noGames, setNoGames] = useState(false);

  /* -------- fetch on sport change -------- */
  useEffect(() => {
    (async () => {
      setLoading(true);
      setNoGames(false);

      const sportKey = SPORT_KEYS[sport];
      const games = await fetchOdds(sportKey);

      if (games.length === 0) {
        setNoGames(true);
        setData(null);
        setLoading(false);
        return;
      }

      const today = new Date();
      const toIso = (d: Date) => d.toISOString().split('T')[0];
      const yest = new Date(today); yest.setDate(today.getDate() - 1);
      const tomo = new Date(today); tomo.setDate(today.getDate() + 1);

      const buckets = { Yesterday: [], Today: [], Tomorrow: [] } as Record<
        string,
        typeof games
      >;

      games.forEach(g => {
        const dateStr = toIso(new Date(g.commence_time));
        if (dateStr === toIso(today)) buckets.Today.push(g);
        else if (dateStr === toIso(yest)) buckets.Yesterday.push(g);
        else if (dateStr === toIso(tomo)) buckets.Tomorrow.push(g);
      });

      const days = (['Yesterday', 'Today', 'Tomorrow'] as const)
        .filter(l => buckets[l].length)
        .map(label => ({
          label,
          date: label,
          games: convertToTickerGames(buckets[label], sportKey)
        }));

      setData({ sport, days });
      setLoading(false);
    })();
  }, [sport]);

  /* --------- render --------- */
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
          <SportSelector selectedSport={sport} onSportChange={setSport} />
        </div>

        {noGames ? (
          <div className="flex items-center justify-center p-2 bg-card border border-border/30 rounded-md">
            <p className="text-sm text-muted-foreground">No games scheduled</p>
          </div>
        ) : (
          data && <TickerContent data={data} />
        )}
      </div>
    </div>
  );
}
