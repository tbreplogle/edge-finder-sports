
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface Game {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  status: "upcoming" | "live" | "final";
  startTime: string;
  sport: "nfl" | "ncaaf" | "ncaab" | "mlb";
  quarter?: string;
  inning?: string;
  timeRemaining?: string;
}

// Sample games data - in a real app, this would come from an API
const sampleGames: Game[] = [
  {
    id: "1",
    homeTeam: "Yankees",
    awayTeam: "Red Sox",
    homeScore: 3,
    awayScore: 1,
    status: "live",
    startTime: "2025-04-30T18:00:00Z",
    sport: "mlb",
    inning: "7th"
  },
  {
    id: "2",
    homeTeam: "Bucks",
    awayTeam: "Celtics",
    homeScore: 88,
    awayScore: 92,
    status: "final",
    startTime: "2025-04-30T17:00:00Z",
    sport: "ncaab",
  },
  {
    id: "3",
    homeTeam: "Cowboys",
    awayTeam: "Eagles",
    status: "upcoming",
    startTime: "2025-05-01T19:30:00Z",
    sport: "nfl",
  }
];

export function LiveScores() {
  const [games, setGames] = useState<Game[]>(sampleGames);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // This is where you would fetch real data from your API
  useEffect(() => {
    // For now, we're just using the sample data
    // In a real implementation, you would fetch data here
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setGames(sampleGames);
      setLoading(false);
    }, 500);
  }, []);

  const getSportColor = (sport: string) => {
    switch (sport) {
      case "nfl": return "bg-edge-nfl text-white";
      case "ncaaf": return "bg-edge-ncaaf text-white";
      case "ncaab": return "bg-edge-ncaab text-white";
      case "mlb": return "bg-edge-mlb text-white";
      default: return "bg-muted text-foreground";
    }
  };

  const getStatusBadge = (game: Game) => {
    switch (game.status) {
      case "live":
        return (
          <Badge variant="secondary" className="animate-pulse bg-red-500 text-white">
            LIVE {game.inning || game.quarter || game.timeRemaining || ""}
          </Badge>
        );
      case "final":
        return <Badge variant="outline">FINAL</Badge>;
      case "upcoming":
        return (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {new Date(game.startTime).toLocaleTimeString('en-US', {
                hour: 'numeric', 
                minute: '2-digit',
                timeZone: 'America/Chicago'
              })}
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold tracking-tight">Live Scores</h2>
        </div>
        
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Live Scores</h2>
        <Button variant="ghost" className="gap-1" onClick={() => navigate('/dashboard')}>
          View All <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {games.map((game) => (
          <Card key={game.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              <div className="p-3 border-b bg-muted/30 flex justify-between items-center">
                <Badge className={cn("font-medium", getSportColor(game.sport))}>
                  {game.sport.toUpperCase()}
                </Badge>
                {getStatusBadge(game)}
              </div>
              
              <div className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p className="font-semibold">{game.awayTeam}</p>
                    <p className="text-sm text-muted-foreground">Away</p>
                  </div>
                  {(game.awayScore !== undefined) && (
                    <span className="text-2xl font-bold">{game.awayScore}</span>
                  )}
                </div>
                
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{game.homeTeam}</p>
                    <p className="text-sm text-muted-foreground">Home</p>
                  </div>
                  {(game.homeScore !== undefined) && (
                    <span className="text-2xl font-bold">{game.homeScore}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
