
import { useState, useEffect } from "react";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";

// Types for the ticker data structure
interface TickerGame {
  id?: string;
  home: string;
  away: string;
  tip?: string;
  final?: boolean;
  score_home?: number;
  score_away?: number;
  spread: number;
  total?: number;
  consensus?: number;
}

interface TickerDay {
  label: string;
  date: string;
  games: TickerGame[];
}

interface TickerData {
  sport: string;
  days: TickerDay[];
}

// Sample ticker data (will be replaced by API call)
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

export function MatchupTicker() {
  const [tickerData, setTickerData] = useState<TickerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    const fetchTickerData = async () => {
      try {
        // In a real implementation, this would be an API call
        // const response = await fetch('/api/ticker?sport=NBA');
        // const data = await response.json();
        
        // For now, use sample data
        setTimeout(() => {
          setTickerData(sampleTickerData);
          setLoading(false);
        }, 500);
      } catch (error) {
        console.error('Failed to fetch ticker data', error);
        setLoading(false);
      }
    };

    fetchTickerData();
  }, []);

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
        </Carousel>
      </div>
    </div>
  );
}
