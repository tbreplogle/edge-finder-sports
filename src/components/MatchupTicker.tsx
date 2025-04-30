
import { useState, useEffect } from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchOdds, SPORT_KEYS, convertToTickerGames, TickerGame, TickerDay, TickerData } from "@/utils/oddsApi";
import { BasketballIcon, FootballIcon, BaseballIcon } from "./SportIcons";

// Component for rendering a single game in the ticker
const TickerGameItem = ({ game }: { game: TickerGame }) => {
  const isFinal = game.final;
  const spreadTeam = game.spread > 0 ? game.home : game.away;
  const spreadValue = Math.abs(game.spread);
  
  return (
    <div className="flex items-center space-x-2 px-3 py-1 bg-card rounded-md border border-border/30 whitespace-nowrap">
      {isFinal ? (
        <>
          <div className="font-semibold">
            <span>{game.away}</span>
            <span className="mx-1 text-muted-foreground">{game.score_away}</span>
          </div>
          <span className="text-muted-foreground">@</span>
          <div className="font-semibold">
            <span>{game.home}</span>
            <span className="mx-1 text-muted-foreground">{game.score_home}</span>
          </div>
          <Badge variant="outline" className="ml-1 text-xs">FINAL</Badge>
        </>
      ) : (
        <>
          <div className="font-semibold">
            <span>{game.away}</span>
          </div>
          <span className="text-muted-foreground">@</span>
          <div className="font-semibold">
            <span>{game.home}</span>
          </div>
          <div className="text-xs text-muted-foreground">{game.tip}</div>
          <div className="text-xs">
            {spreadTeam} -{spreadValue}
          </div>
        </>
      )}
    </div>
  );
};

// Component for rendering a group of games for a day
const TickerDayGroup = ({ day }: { day: TickerDay }) => {
  const isMobile = useIsMobile();
  
  return (
    <div className="flex flex-col">
      <div className="flex gap-2 items-center mb-1">
        <Badge variant="secondary" className="text-xs">{day.label}</Badge>
        <div className="flex gap-2">
          {!isMobile && day.games.slice(0, 3).map((game) => (
            <TickerGameItem key={game.id} game={game} />
          ))}
          {isMobile && day.games.slice(0, 1).map((game) => (
            <TickerGameItem key={game.id} game={game} />
          ))}
        </div>
      </div>
    </div>
  );
};

// Sport icon selector function
const getSportIcon = (sport: string) => {
  switch (sport.toLowerCase()) {
    case 'nfl':
    case 'ncaaf':
      return <FootballIcon className="h-4 w-4 mr-2" />;
    case 'nba':
    case 'ncaab':
      return <BasketballIcon className="h-4 w-4 mr-2" />;
    case 'mlb':
      return <BaseballIcon className="h-4 w-4 mr-2" />;
    default:
      return <BasketballIcon className="h-4 w-4 mr-2" />;
  }
};

export function MatchupTicker() {
  const [selectedSport, setSelectedSport] = useState<string>("nba");
  const [tickerData, setTickerData] = useState<TickerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch data from Odds API
    const fetchTickerData = async () => {
      try {
        setLoading(true);
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
          const days: TickerDay[] = [];
          
          if (yesterdayGames.length > 0) {
            days.push({
              label: 'Yesterday',
              date: yesterdayStr,
              games: convertToTickerGames(yesterdayGames),
            });
          }
          
          if (todayGames.length > 0) {
            days.push({
              label: 'Today',
              date: todayStr,
              games: convertToTickerGames(todayGames),
            });
          }
          
          if (tomorrowGames.length > 0) {
            days.push({
              label: 'Tomorrow',
              date: tomorrowStr,
              games: convertToTickerGames(tomorrowGames),
            });
          }
          
          setTickerData({
            sport: selectedSport.toUpperCase(),
            days,
          });
        } else {
          // Fallback to sample data if API returns no games
          setTickerData(sampleTickerData);
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

  if (!tickerData) {
    return null;
  }

  return (
    <div className="w-full bg-muted/20 border-b overflow-hidden">
      <div className="container py-2">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium">Match-ups</h3>
          <Select value={selectedSport} onValueChange={handleSportChange}>
            <SelectTrigger className="w-[130px] h-8">
              <SelectValue>
                <div className="flex items-center">
                  {getSportIcon(selectedSport)}
                  <span>{selectedSport.toUpperCase()}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nfl" className="flex items-center">
                <div className="flex items-center">
                  <FootballIcon className="h-4 w-4 mr-2" />
                  <span>NFL</span>
                </div>
              </SelectItem>
              <SelectItem value="ncaaf" className="flex items-center">
                <div className="flex items-center">
                  <FootballIcon className="h-4 w-4 mr-2" />
                  <span>NCAAF</span>
                </div>
              </SelectItem>
              <SelectItem value="nba" className="flex items-center">
                <div className="flex items-center">
                  <BasketballIcon className="h-4 w-4 mr-2" />
                  <span>NBA</span>
                </div>
              </SelectItem>
              <SelectItem value="ncaab" className="flex items-center">
                <div className="flex items-center">
                  <BasketballIcon className="h-4 w-4 mr-2" />
                  <span>NCAAB</span>
                </div>
              </SelectItem>
              <SelectItem value="mlb" className="flex items-center">
                <div className="flex items-center">
                  <BaseballIcon className="h-4 w-4 mr-2" />
                  <span>MLB</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Carousel 
          opts={{
            align: "start",
            loop: true,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-2">
            {tickerData.days.map((day, index) => (
              <CarouselItem key={day.date} className="pl-2 flex-shrink-0 basis-auto">
                <TickerDayGroup day={day} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="hidden sm:block">
            <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2" />
            <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2" />
          </div>
        </Carousel>
      </div>
    </div>
  );
}

// Sample ticker data (fallback if API fails)
const sampleTickerData: TickerData = {
  sport: "NBA",
  days: [
    {
      label: "Yesterday",
      date: "2025-05-01",
      games: [
        {
          id: "nba-1",
          home: "MIL",
          away: "IND",
          final: true,
          score_home: 118,
          score_away: 119,
          spread: 8,
          total: 222
        },
        {
          id: "nba-2",
          home: "DEN",
          away: "LAL",
          final: true,
          score_home: 124,
          score_away: 103,
          spread: -5,
          total: 227
        }
      ]
    },
    {
      label: "Today",
      date: "2025-05-02",
      games: [
        {
          id: "nba-3",
          home: "GS",
          away: "HOU",
          tip: "7:30 PM CT",
          spread: 4,
          consensus: 59,
          total: 204
        },
        {
          id: "nba-4",
          home: "BOS",
          away: "NYK",
          tip: "8:00 PM CT",
          spread: -3.5,
          consensus: 67,
          total: 211
        }
      ]
    },
    {
      label: "Tomorrow",
      date: "2025-05-03",
      games: [
        {
          id: "nba-5",
          home: "PHX",
          away: "DAL",
          tip: "6:30 PM CT",
          spread: -1.5,
          consensus: 52,
          total: 215
        },
        {
          id: "nba-6",
          home: "PHI",
          away: "MIA",
          tip: "7:00 PM CT",
          spread: 2,
          consensus: 61,
          total: 208
        }
      ]
    }
  ]
};
