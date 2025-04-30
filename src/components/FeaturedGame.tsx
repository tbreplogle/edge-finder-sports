import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, ArrowRight, ArrowUp, ArrowDown, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface FeaturedGameProps {
  isPreview?: boolean;
}

interface FeaturedGame {
  id: string;
  sport: "nfl" | "ncaaf" | "ncaab" | "mlb";
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  marketSpread: number;
  predictedMargin: number;
  edge: number;
  confidence?: number;
}

export function FeaturedGame({ isPreview = false }: FeaturedGameProps) {
  const [game, setGame] = useState<FeaturedGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchFeaturedGame() {
      try {
        // If in preview mode, use seed data
        if (isPreview) {
          // Import seed data
          const { seedGames } = await import("../supabase/functions/utils/seed");
          // Use the first game with the highest edge value
          const featuredGame = [...seedGames].sort((a, b) => Math.abs((b.edge || 0)) - Math.abs((a.edge || 0)))[0];
          setGame(featuredGame as FeaturedGame);
          setLoading(false);
          return;
        }

        // Otherwise, fetch from our API
        const { data, error } = await supabase.functions.invoke('get-predictions', {
          body: { featureOne: true },
        });

        if (error) throw new Error(error.message);
        
        if (data && data.length > 0) {
          // Get the game with the highest absolute edge
          const featuredGame = data.sort((a: any, b: any) => 
            Math.abs(b.edge || 0) - Math.abs(a.edge || 0)
          )[0];
          
          setGame(featuredGame);
        }
        
      } catch (err: any) {
        console.error("Error fetching featured game:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchFeaturedGame();
  }, [isPreview]);

  if (loading) {
    return (
      <Card className="w-full bg-gradient-to-r from-edge-primary/80 to-edge-secondary/20 h-80 animate-pulse">
        <CardContent className="flex items-center justify-center h-full">
          <p className="text-lg text-white/80">Loading featured matchup...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !game) {
    return (
      <Card className="w-full bg-gradient-to-r from-edge-primary/40 to-edge-secondary/10 h-80">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-lg text-muted-foreground mb-4">No featured matchup available today</p>
            <Button onClick={() => navigate("/dashboard")}>
              Browse All Predictions
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPositiveEdge = game.edge > 0;
  const formattedDate = new Date(game.startTime).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago'
  });

  return (
    <Card className={cn(
      "w-full overflow-hidden border-0", 
      "bg-gradient-to-r from-edge-primary/80 to-edge-secondary/20",
      `edge-sport-${game.sport}`
    )}>
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row h-full">
          <div className="md:w-2/3 p-6 md:p-10">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="bg-black/30 text-white border-white/20">
                {game.sport.toUpperCase()}
              </Badge>
              <Badge variant="secondary" className="flex gap-1 items-center">
                <Trophy className="w-3 h-3" />
                <span>Game of the Day</span>
              </Badge>
            </div>
            
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-2">
              {game.awayTeam} @ {game.homeTeam}
            </h2>
            
            <p className="text-white/80 mb-6">{formattedDate}</p>
            
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-white/70 text-sm mb-1">Market Spread</p>
                <p className="text-white font-semibold text-lg">
                  {game.marketSpread > 0 
                    ? `${game.homeTeam} -${Math.abs(game.marketSpread)}` 
                    : game.marketSpread < 0 
                      ? `${game.awayTeam} -${Math.abs(game.marketSpread)}` 
                      : "Pick'em"}
                </p>
              </div>
              
              <div>
                <p className="text-white/70 text-sm mb-1">Predicted Margin</p>
                <p className="text-white font-semibold text-lg">
                  {game.predictedMargin > 0 
                    ? `${game.homeTeam} by ${game.predictedMargin.toFixed(1)}` 
                    : game.predictedMargin < 0 
                      ? `${game.awayTeam} by ${Math.abs(game.predictedMargin).toFixed(1)}` 
                      : "Even"}
                </p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-white/70 text-sm mb-1">Edge</p>
              <div className="flex items-center gap-2">
                {isPositiveEdge ? (
                  <>
                    <ArrowUp className="w-5 h-5 text-white" />
                    <span className="text-white font-bold text-2xl">
                      {game.edge.toFixed(1)} pts
                    </span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="w-5 h-5 text-white" />
                    <span className="text-white font-bold text-2xl">
                      {game.edge.toFixed(1)} pts
                    </span>
                  </>
                )}
                
                {game.confidence && (
                  <span className="ml-auto text-white/70">
                    {game.confidence}% confidence
                  </span>
                )}
              </div>
            </div>
            
            <Button 
              variant="default" 
              className="bg-white text-edge-primary hover:bg-white/90"
              onClick={() => navigate("/dashboard")}
            >
              View Full Analysis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          
          <div className="md:w-1/3 bg-black/20 flex items-center justify-center p-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/10 mb-4">
                <Star className="w-10 h-10 text-white" />
              </div>
              <p className="text-white/90 font-medium">
                Top Edge
              </p>
              <p className="text-xl font-bold text-white">
                {Math.abs(game.edge).toFixed(1)} points
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
