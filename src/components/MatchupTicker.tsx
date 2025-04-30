
import { useState, useEffect } from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchOdds, SPORT_KEYS, convertToTickerGames, TickerGame, TickerDay, TickerData, DEFAULT_SPORT } from "@/utils/oddsApi";
import { BasketballIcon, FootballIcon, BaseballIcon } from "./SportIcons";

// Component for rendering a single game in the ticker
const TickerGameItem = ({ game }: { game: TickerGame }) => {
  const isFinal = game.final;
  const isBaseball = game.sport_key?.includes('baseball');
  
  // Display appropriate odds based on sport and predictions
  let oddsDisplay;
  if (isBaseball && game.moneyline !== undefined) {
    // For baseball, show moneyline with correct sign
    const moneylineSign = game.moneyline > 0 ? '+' : '';
    oddsDisplay = <div className="text-xs">{game.home} {moneylineSign}{game.moneyline}</div>;
  } else if (game.predicted_margin !== undefined) {
    // Show predicted margin if available
    const predictedTeam = game.predicted_margin > 0 ? game.home : game.away;
    const predictedValue = Math.abs(game.predicted_margin).toFixed(1);
    const predictedSign = game.predicted_margin > 0 ? '+' : '-';
    oddsDisplay = (
      <div className="text-xs flex items-center">
        <span className="text-edge-secondary font-medium">{predictedTeam} {predictedSign}{predictedValue}</span>
        <span className="ml-1 text-muted-foreground text-[10px]">(pred)</span>
      </div>
    );
  } else {
    // Default to showing spread
    const spreadTeam = game.spread > 0 ? game.home : game.away;
    const spreadValue = Math.abs(game.spread);
    const spreadSign = game.spread > 0 ? '+' : '-';
    oddsDisplay = <div className="text-xs">{spreadTeam} {spreadSign}{spreadValue}</div>;
  }
  
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
          {oddsDisplay}
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
    case 'ncaab':
      return <BasketballIcon className="h-4 w-4 mr-2" />;
    case 'mlb':
      return <BaseballIcon className="h-4 w-4 mr-2" />;
    default:
      return <FootballIcon className="h-4 w-4 mr-2" />;
  }
};

export function MatchupTicker() {
  const [selectedSport, setSelectedSport] = useState<string>(DEFAULT_SPORT);
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
              <SelectItem value="NFL" className="flex items-center">
                <div className="flex items-center">
                  <FootballIcon className="h-4 w-4 mr-2" />
                  <span>NFL</span>
                </div>
              </SelectItem>
              <SelectItem value="NCAAF" className="flex items-center">
                <div className="flex items-center">
                  <FootballIcon className="h-4 w-4 mr-2" />
                  <span>NCAAF</span>
                </div>
              </SelectItem>
              <SelectItem value="NCAAB" className="flex items-center">
                <div className="flex items-center">
                  <BasketballIcon className="h-4 w-4 mr-2" />
                  <span>NCAAB</span>
                </div>
              </SelectItem>
              <SelectItem value="MLB" className="flex items-center">
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
  sport: "NFL",
  days: [
    {
      label: "Yesterday",
      date: "2025-05-01",
      games: [
        {
          id: "nfl-1",
          home: "KC",
          away: "BAL",
          final: true,
          score_home: 24,
          score_away: 21,
          spread: -3,
          total: 44,
          predicted_margin: -2.7,
          predicted_total: 42,
          consensus: 58
        },
        {
          id: "nfl-2",
          home: "SF",
          away: "DAL",
          final: true,
          score_home: 28,
          score_away: 17,
          spread: -4.5,
          total: 46,
          predicted_margin: -5.2,
          predicted_total: 44,
          consensus: 61
        }
      ]
    },
    {
      label: "Today",
      date: "2025-05-02",
      games: [
        {
          id: "nfl-3",
          home: "BUF",
          away: "MIA",
          tip: "7:30 PM CT",
          spread: -6,
          consensus: 59,
          total: 45,
          predicted_margin: -5.4,
          predicted_total: 47
        },
        {
          id: "nfl-4",
          home: "PHI",
          away: "NYG",
          tip: "8:00 PM CT",
          spread: -3.5,
          consensus: 67,
          total: 42,
          predicted_margin: -4.2,
          predicted_total: 40
        }
      ]
    },
    {
      label: "Tomorrow",
      date: "2025-05-03",
      games: [
        {
          id: "nfl-5",
          home: "GB",
          away: "MIN",
          tip: "6:30 PM CT",
          spread: -1.5,
          consensus: 52,
          total: 48,
          predicted_margin: -0.9,
          predicted_total: 46
        },
        {
          id: "nfl-6",
          home: "LAR",
          away: "ARI",
          tip: "7:00 PM CT",
          spread: -2,
          consensus: 61,
          total: 47,
          predicted_margin: -2.7,
          predicted_total: 49
        }
      ]
    }
  ]
};
