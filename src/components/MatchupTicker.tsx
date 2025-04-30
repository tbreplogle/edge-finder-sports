
import { useState, useEffect } from "react";
import { SportSelector } from "./ticker/SportSelector";
import { TickerContent } from "./ticker/TickerContent";
import { fetchOdds, SPORT_KEYS, convertToTickerGames, TickerGame } from "@/utils/oddsApi";
import { DEFAULT_SPORT } from "@/utils/config/sportKeys";
import { sampleTickerData } from "./ticker/SampleTickerData";

export interface TickerData {
  sport: string;
  days: {
    label: string;
    date: string;
    games: TickerGame[];
  }[];
}

export function MatchupTicker() {
  const [selectedSport, setSelectedSport] = useState<string>(DEFAULT_SPORT);
  const [tickerData, setTickerData] = useState<TickerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noGames, setNoGames] = useState(false);

  useEffect(() => {
    // Fetch data from Odds API
    const fetchTickerData = async () => {
      try {
        setLoading(true);
        setNoGames(false);
        
        // Use selected sport key
        const sportKey = SPORT_KEYS[selectedSport as keyof typeof SPORT_KEYS];
        const gamesData = await fetchOdds(sportKey);
        
        if (gamesData.length > 0) {
          // Group games by date
          const today = new Date();
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          
          // Format dates for comparison
          const todayStr = today.toISOString().split('T')[0];
          const tomorrowStr = tomorrow.toISOString().split('T')[0];
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          
          // Group games by day
          const todayGames = [];
          const tomorrowGames = [];
          const yesterdayGames = [];
          
          for (const game of gamesData) {
            const gameDate = new Date(game.commence_time).toISOString().split('T')[0];
            
            if (gameDate === todayStr) {
              todayGames.push(game);
            } else if (gameDate === tomorrowStr) {
              tomorrowGames.push(game);
            } else if (gameDate === yesterdayStr) {
              yesterdayGames.push(game);
            }
          }
          
          // Create ticker data structure
          const days = [];
          
          if (yesterdayGames.length > 0) {
            days.push({
              label: 'Yesterday',
              date: yesterdayStr,
              games: convertToTickerGames(yesterdayGames, sportKey),
            });
          }
          
          if (todayGames.length > 0) {
            days.push({
              label: 'Today',
              date: todayStr,
              games: convertToTickerGames(todayGames, sportKey),
            });
          }
          
          if (tomorrowGames.length > 0) {
            days.push({
              label: 'Tomorrow',
              date: tomorrowStr,
              games: convertToTickerGames(tomorrowGames, sportKey),
            });
          }
          
          if (days.length > 0) {
            setTickerData({
              sport: selectedSport.toUpperCase(),
              days,
            });
          } else {
            setNoGames(true);
          }
        } else {
          // No games returned
          setNoGames(true);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch ticker data', error);
        // Fallback to sample data on error
        setTickerData(sampleTickerData);
        setLoading(false);
      }
    };

    fetchTickerData();
  }, [selectedSport]);

  const handleSportChange = (value: string) => {
    setSelectedSport(value);
  };

  if (loading) {
    return (
      <div className="w-full bg-muted/20 h-12 flex items-center justify-center">
        <p className="text-xs text-muted-foreground">Loading matchup data...</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-muted/20 border-b overflow-hidden">
      <div className="container py-2">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium">Match-ups</h3>
          <SportSelector selectedSport={selectedSport} onSportChange={handleSportChange} />
        </div>
        {noGames ? (
          <div className="flex items-center justify-center p-2 bg-card rounded-md border border-border/30">
            <p className="text-sm text-muted-foreground">No games scheduled</p>
          </div>
        ) : tickerData ? (
          <TickerContent data={tickerData} />
        ) : null}
      </div>
    </div>
  );
}
