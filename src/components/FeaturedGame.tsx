import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, ArrowRight, ArrowUp, ArrowDown, Trophy, Lock } from "lucide-react";
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
}

export function FeaturedGame({ isPreview = false }: FeaturedGameProps) {
  const [game, setGame] = useState<FeaturedGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const navigate = useNavigate();

  // Check if user is admin or paid
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setIsAdmin(user.is_admin === true);
        setIsPaid(user.role === "premium" || user.is_admin === true);
      } catch (e) {
        console.error("Error parsing user data:", e);
      }
    }
  }, []);

  useEffect(() => {
    async function fetchFeaturedGame() {
      try {
        // If in preview mode, use seed data
        if (isPreview) {
          // Import seed data
          const { seedGames } = await import("@/utils/seedData");
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
      <Card className="w-full bg-gradient-to-r from-edge-primary/80 to-edge-secondary/20 h-48 animate-pulse">
        <CardContent className="flex items-center justify-center h-full">
          <p className="text-sm text-white/80">Loading featured matchup...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !game) {
    return (
      <Card className="w-full bg-gradient-to-r from-edge-primary/40 to-edge-secondary/10 h-48">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">No featured matchup available</p>
            <Button size="sm" onClick={() => navigate("/dashboard")}>
              Browse Predictions
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
  
  // All users should see the blurred premium version
  const shouldBlur = !isPaid && !isAdmin;

  return (
    <Card className={cn(
      "w-full overflow-hidden border-0 relative", 
      "bg-gradient-to-r from-edge-primary/80 to-edge-secondary/20",
      `edge-sport-${game.sport}`
    )}>
      <CardContent className="p-0">
        <div className="flex flex-col h-full">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-black/30 text-white border-white/20">
                {game.sport.toUpperCase()}
              </Badge>
              <Badge variant="secondary" className="flex gap-1 items-center">
                <Trophy className="w-3 h-3" />
                <span>Game of the Day</span>
              </Badge>
            </div>
            
            <h3 className={cn(
              "text-lg font-bold text-white mb-1",
              shouldBlur && "blur-sm"
            )}>
              {game.awayTeam} @ {game.homeTeam}
            </h3>
            
            <p className="text-white/80 text-xs mb-3">{formattedDate}</p>
            
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-white/70 text-xs mb-0.5">Market Spread</p>
                <p className={cn(
                  "text-white font-semibold text-sm",
                  shouldBlur && "blur-sm"
                )}>
                  {game.marketSpread > 0 
                    ? `${game.homeTeam} -${Math.abs(game.marketSpread)}` 
                    : game.marketSpread < 0 
                      ? `${game.awayTeam} -${Math.abs(game.marketSpread)}` 
                      : "Pick'em"}
                </p>
              </div>
              
              <div>
                <p className="text-white/70 text-xs mb-0.5">Predicted Margin</p>
                <p className={cn(
                  "text-white font-semibold text-sm",
                  shouldBlur && "blur-sm"
                )}>
                  {game.predictedMargin > 0 
                    ? `${game.homeTeam} by ${game.predictedMargin.toFixed(1)}` 
                    : game.predictedMargin < 0 
                      ? `${game.awayTeam} by ${Math.abs(game.predictedMargin).toFixed(1)}` 
                      : "Even"}
                </p>
              </div>
            </div>
            
            <div className="mb-3">
              <p className="text-white/70 text-xs mb-0.5">Edge</p>
              <div className={cn(
                "flex items-center gap-2",
                shouldBlur && "blur-sm"
              )}>
                {isPositiveEdge ? (
                  <>
                    <ArrowUp className="w-4 h-4 text-white" />
                    <span className="text-white font-bold text-sm">
                      {game.edge.toFixed(1)} pts
                    </span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="w-4 h-4 text-white" />
                    <span className="text-white font-bold text-sm">
                      {game.edge.toFixed(1)} pts
                    </span>
                  </>
                )}
              </div>
            </div>
            
            <Button 
              variant="default" 
              size="sm"
              className="bg-white text-edge-primary hover:bg-white/90 w-full"
              onClick={() => navigate(isPaid ? "/dashboard" : "/pricing")}
            >
              {isPaid ? "View Full Analysis" : "Upgrade to View"}
              <ArrowRight className="ml-2 h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
      
      {/* Premium overlay */}
      {shouldBlur && (
        <div className="absolute inset-0 flex flex-col items-center justify-center 
                       bg-black/30 z-10">
          <Lock className="h-6 w-6 text-white mb-1.5" />
          <span className="text-white font-medium text-sm">Premium Content</span>
          <Button 
            variant="default" 
            size="sm"
            className="mt-3"
            onClick={() => navigate("/pricing")}
          >
            Upgrade Now
          </Button>
        </div>
      )}
    </Card>
  );
}
