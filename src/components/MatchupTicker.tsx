
import { useState, useEffect } from 'react';
import { SportSelector } from './ticker/SportSelector';
import { TickerContent } from './ticker/TickerContent';
import { Separator } from '@/components/ui/separator';
import { FeaturedGame } from './FeaturedGame';
import { LiveScores } from './LiveScores';
import {
  fetchOdds,
  convertToTickerGames,
  SPORT_KEYS
} from '@/utils/oddsApi';
import { DEFAULT_SPORT } from '@/utils/config/sportKeys';
import { TickerData } from '@/utils/types/sports';
import { getDateInTimeZone, isDateOnDayInTimeZone } from '@/utils/helpers/dateFormatting';

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
        
        // Get today
        const today = new Date();
        const todayStr = getDateInTimeZone(today, timeZone);
        
        // Calculate yesterday and tomorrow
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        const buckets: Record<string, typeof games> = {
          Yesterday: [],
          Today: [],
          Tomorrow: []
        };

        games.forEach(g => {
          const gameDate = new Date(g.commence_time);
          
          if (isDateOnDayInTimeZone(gameDate, today, timeZone)) {
            buckets.Today.push(g);
          } else if (isDateOnDayInTimeZone(gameDate, yesterday, timeZone)) {
            buckets.Yesterday.push(g);
          } else if (isDateOnDayInTimeZone(gameDate, tomorrow, timeZone)) {
            buckets.Tomorrow.push(g);
          }
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
      <div className="w-full bg-muted/30 h-16 flex items-center justify-center border-b">
        <p className="text-xs text-muted-foreground">Loading matchup data…</p>
      </div>
    );

  return (
    <div className="w-full bg-muted/30 border-b overflow-hidden py-1.5">
      <div className="container">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center mb-4">
          <div className="flex items-center">
            <h3 className="text-sm font-semibold text-foreground mr-3">Game Matchups</h3>
            <SportSelector 
              selectedSport={sport} 
              onSportChange={(value) => setSport(value as keyof typeof SPORT_KEYS)} 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Featured game for the current sport */}
          <div className="col-span-1">
            <FeaturedGame isPreview={false} />
          </div>
          
          {/* Ticker content */}
          <div className="col-span-1 md:col-span-2">
            {noGames ? (
              <div className="flex items-center justify-center p-4 bg-card
                            border border-border/30 rounded-md">
                <p className="text-sm text-muted-foreground">No games scheduled for {sport.toUpperCase()}</p>
              </div>
            ) : (
              data && <TickerContent data={data} />
            )}
          </div>
        </div>

        {/* LiveScores component instead of LatestNews */}
        <div className="mt-8">
          <LiveScores />
        </div>
      </div>
    </div>
  );
}
