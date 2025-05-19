
import { AppLayout } from "@/components/AppLayout";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Info, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { format } from "date-fns";
import { GameCard } from "@/components/GameCard";
import { PremiumBanner } from "@/components/PremiumBanner";
import { fetchMlbPredictions, ProcessedMlbPrediction } from "@/utils/fetchMlbPredictions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const MlbDashboard = () => {
  const { toast } = useToast();
  const [predictions, setPredictions] = useState<ProcessedMlbPrediction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string | null>("guest");
  const [generatedDate, setGeneratedDate] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Check authentication state from localStorage (for demo purposes)
  useEffect(() => {
    const isAdmin = localStorage.getItem("isAdmin") === "true";
    setIsAuthenticated(!!localStorage.getItem("token"));
    setUserRole(isAdmin ? "admin" : localStorage.getItem("userRole") || "guest");
  }, []);

  // Fetch MLB predictions
  const fetchPredictions = async (skipLoading = false) => {
    if (!skipLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const data = await fetchMlbPredictions();
      setPredictions(data);
      setGeneratedDate(format(new Date(), "MMM d, yyyy"));
    } catch (error) {
      console.error('Error fetching MLB predictions:', error);
      toast({
        title: "Error",
        description: "Failed to load MLB predictions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch predictions on component mount
  useEffect(() => {
    fetchPredictions();
  }, []);

  // Manual refresh handler
  const handleRefresh = () => {
    fetchPredictions(true);
  };

  // Check if we have a preview game (first game for guests)
  const hasPreviewGame = userRole === 'guest' && predictions.length > 0;
  
  // Format today's date for display
  const todayFormatted = format(new Date(), "MMM d, yyyy");
  
  return (
    <AppLayout isAuthenticated={isAuthenticated}>
      <div className="container py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">MLB Predictions Dashboard</h1>
            <p className="text-muted-foreground">
              Today's MLB games with moneyline predictions and market edges
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
            
            <Button variant="outline" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{generatedDate || todayFormatted}</span>
            </Button>
          </div>
        </div>

        {userRole === 'guest' && (
          <Alert className="mb-6 bg-muted">
            <Info className="h-4 w-4" />
            <AlertTitle>Preview Mode</AlertTitle>
            <AlertDescription>
              You're viewing in guest preview mode. Limited game predictions are shown.
            </AlertDescription>
          </Alert>
        )}
        
        {hasPreviewGame && (
          <Alert className="mb-6 border-edge-secondary bg-edge-secondary/10">
            <Info className="h-4 w-4 text-edge-secondary" />
            <AlertTitle>Preview Game</AlertTitle>
            <AlertDescription>
              The first game below shows premium details as a preview. Create an account to access all predictions.
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading MLB predictions...</p>
          </div>
        ) : predictions.length > 0 ? (
          <div>
            {/* Featured Games Section */}
            {predictions.some(game => game.home_edge_pct !== null && Math.abs(game.home_edge_pct) > 0.05 || 
                                      game.away_edge_pct !== null && Math.abs(game.away_edge_pct) > 0.05) && (
              <div className="mb-8">
                <h2 className="text-xl font-bold mb-4">Featured Games</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {predictions
                    .filter(game => {
                      // Games with significant edges (>5%)
                      return (game.home_edge_pct !== null && Math.abs(game.home_edge_pct) > 0.05) || 
                             (game.away_edge_pct !== null && Math.abs(game.away_edge_pct) > 0.05);
                    })
                    .slice(0, 3) // Limit to 3 featured games
                    .map(game => (
                      <GameCard
                        key={game.matchup_id}
                        id={game.matchup_id}
                        homeTeam={game.home_team}
                        awayTeam={game.away_team}
                        startTime={game.game_time_ct}
                        homeMarketMoneyline={game.home_market_ml}
                        awayMarketMoneyline={game.away_market_ml}
                        homePredictedOdds={game.home_pred_ml}
                        awayPredictedOdds={game.away_pred_ml} 
                        homePredictedPct={game.home_pred_pct}
                        awayPredictedPct={game.away_pred_pct}
                        homeEdgePct={game.home_edge_pct}
                        awayEdgePct={game.away_edge_pct}
                        homePitcher={game.home_pitcher}
                        awayPitcher={game.away_pitcher}
                        sport="mlb"
                        isPremium={userRole === 'premium' || userRole === 'admin'}
                        isAdmin={userRole === 'admin'}
                        variant="featured"
                      />
                    ))}
                </div>
              </div>
            )}

            {/* All Games Section */}
            <div>
              <h2 className="text-xl font-bold mb-4">All MLB Games</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {predictions.map((game, index) => (
                  <GameCard
                    key={game.matchup_id}
                    id={game.matchup_id}
                    homeTeam={game.home_team}
                    awayTeam={game.away_team}
                    startTime={game.game_time_ct}
                    homeMarketMoneyline={game.home_market_ml}
                    awayMarketMoneyline={game.away_market_ml}
                    homePredictedOdds={game.home_pred_ml}
                    awayPredictedOdds={game.away_pred_ml}
                    homePredictedPct={game.home_pred_pct}
                    awayPredictedPct={game.away_pred_pct}
                    homeEdgePct={game.home_edge_pct}
                    awayEdgePct={game.away_edge_pct}
                    homePitcher={game.home_pitcher}
                    awayPitcher={game.away_pitcher}
                    sport="mlb"
                    isPremium={userRole === 'premium' || userRole === 'admin'}
                    isAdmin={userRole === 'admin'}
                    isPreviewGame={userRole === 'guest' && index === 0}
                    variant={userRole === 'guest' && index !== 0 ? "locked" : "default"}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 border rounded-lg bg-card p-8">
            <p className="text-xl font-medium text-foreground mb-2">No MLB games scheduled today</p>
            <p className="text-muted-foreground">Check back later for MLB predictions.</p>
          </div>
        )}
        
        {userRole !== 'premium' && userRole !== 'admin' && (
          <PremiumBanner />
        )}
        
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>MLB Prediction Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Understanding Moneylines</h4>
                <p className="text-sm text-muted-foreground">
                  Moneylines represent the odds for a team to win. Negative numbers (like -150) indicate favorites, 
                  meaning you'd need to bet that amount to win $100. Positive numbers (like +130) indicate underdogs, 
                  meaning a $100 bet would win that amount.
                </p>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-medium mb-1">Edge Percentage</h4>
                <p className="text-sm text-muted-foreground">
                  The edge percentage shows the difference between our predicted win probability and the implied 
                  probability from the market odds. A positive edge suggests a potential betting opportunity.
                </p>
              </div>

              <Separator />
              
              <div>
                <h4 className="font-medium mb-1">Pitching Matchups</h4>
                <p className="text-sm text-muted-foreground">
                  Our predictions consider the starting pitchers for each game, their recent performance metrics, 
                  and historical data against opposing teams.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default MlbDashboard;
