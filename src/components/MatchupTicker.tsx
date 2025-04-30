
import { useState, useEffect } from 'react';
import { SportSelector } from './ticker/SportSelector';
import { DateSelector } from './ticker/DateSelector';
import { TickerContent } from './ticker/TickerContent';
import { Info } from 'lucide-react';
import {
  fetchOdds,
  convertToTickerGames,
  SPORT_KEYS
} from '@/utils/oddsApi';
import { DEFAULT_SPORT } from '@/utils/config/sportKeys';
import { TickerData, TickerGame } from '@/utils/types/sports';
import { getDateInTimeZone, isDateOnDayInTimeZone } from '@/utils/helpers/dateFormatting';

export function MatchupTicker() {
  const [sport, setSport] = useState<keyof typeof SPORT_KEYS>(DEFAULT_SPORT);
  const [data, setData] = useState<TickerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noGames, setNoGames] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('Today');
  const [availableDates, setAvailableDates] = useState<string[]>(['Today']);
  const [currentGames, setCurrentGames] = useState<TickerGame[]>([]);

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
          setAvailableDates(['Today']);
          setSelectedDate('Today');
          return;
        }

        /* ---- bucket Yesterday / Today / Tomorrow using Chicago time zone ---- */
        const timeZone = 'America/Chicago';
        
        // Get today
        const now = new Date();
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

        // Filter out games that have already started
        const upcomingGames = games.filter(g => {
          const gameTime = new Date(g.commence_time);
          return gameTime > now;
        });

        upcomingGames.forEach(g => {
          const gameDate = new Date(g.commence_time);
          
          if (isDateOnDayInTimeZone(gameDate, today, timeZone)) {
            buckets.Today.push(g);
          } else if (isDateOnDayInTimeZone(gameDate, yesterday, timeZone)) {
            buckets.Yesterday.push(g);
          } else if (isDateOnDayInTimeZone(gameDate, tomorrow, timeZone)) {
            buckets.Tomorrow.push(g);
          }
        });

        // Determine which dates have games
        const dates = (['Yesterday', 'Today', 'Tomorrow'] as const)
          .filter(l => buckets[l].length);
        
        // Default to Today if it has games, otherwise use the first available date
        let initialSelectedDate = 'Today';
        if (!buckets.Today.length && dates.length > 0) {
          initialSelectedDate = dates[0];
        }
        
        setAvailableDates(dates);
        setSelectedDate(initialSelectedDate);

        const days = dates.map(label => ({
          label,
          date: label,
          games: convertToTickerGames(buckets[label], sportKey)
        }));

        setData({ sport, days });
      } catch (err) {
        console.error('[Ticker] fetch failed', err);
        setNoGames(true);
        setData(null);
        setAvailableDates(['Today']);
        setSelectedDate('Today');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sport]);

  // Update current games when selected date or data changes
  useEffect(() => {
    if (data && data.days) {
      const dayData = data.days.find(day => day.label === selectedDate);
      setCurrentGames(dayData?.games || []);
    } else {
      setCurrentGames([]);
    }
  }, [selectedDate, data]);

  /* ========== UI ========== */
  if (loading)
    return (
      <div className="w-full bg-edge-bg h-12 sm:h-16 flex items-center justify-center border-b">
        <p className="text-xs text-muted-foreground">Loading matchup data…</p>
      </div>
    );

  return (
    <div className="w-full bg-edge-bg border-b overflow-hidden py-1">
      <div className="w-full max-w-7xl 3xl:max-w-screen-3xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="flex flex-col md:flex-row gap-2 md:gap-3 items-start md:items-center mb-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground">Game Matchups</h3>
            <SportSelector 
              selectedSport={sport} 
              onSportChange={(value) => setSport(value as keyof typeof SPORT_KEYS)} 
            />
          </div>
          
          {availableDates.length > 1 && (
            <DateSelector 
              selectedDate={selectedDate}
              availableDates={availableDates}
              onDateChange={setSelectedDate}
            />
          )}
          
          <div className="hidden sm:flex items-center text-xs text-muted-foreground ml-auto">
            <Info className="h-3 sm:h-3.5 w-3 sm:w-3.5 mr-1 sm:mr-1.5" />
            <span>Latest odds and upcoming games for {sport.toUpperCase()}</span>
          </div>
        </div>

        {/* Ticker content */}
        <div className="mb-2 w-full">
          {noGames ? (
            <div className="flex items-center justify-center p-3 sm:p-4 bg-edge-primary
                          border border-edge-neutral/30 text-white rounded-md w-full">
              <p className="text-xs sm:text-sm">No upcoming games scheduled for {sport.toUpperCase()}</p>
            </div>
          ) : (
            <TickerContent games={currentGames} />
          )}
        </div>
      </div>
    </div>
  );
}
