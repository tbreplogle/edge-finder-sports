import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Calendar, RefreshCw, Info, Trophy, Lock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { MlbPredictionsTable } from "@/components/admin/MlbPredictionsTable";
import { fetchMlbPredictions, ProcessedMlbPrediction } from "@/utils/fetchMlbPredictions";
import { findHighestEdgePrediction } from "@/lib/utils";
import { GameCard } from "@/components/GameCard";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { PremiumBanner } from "@/components/PremiumBanner";

// Define the interface that MlbPredictionsTable expects
interface MlbPredictionDisplay {
  matchup_id: string;
  game_id: string;
  home_team: string;
  away_team: string;
  game_date: string;
  game_time_ct: string;
  home_market_ml: number | null;
  away_market_ml: number | null;
  home_market_pct: number | null;
  away_market_pct: number | null;
  home_pred_pct: number | null;
  away_pred_pct: number | null;
  home_pred_ml: number | null;
  away_pred_ml: number | null;
  home_edge_pct: number | null;
  away_edge_pct: number | null;
  home_pitcher: string | null;
  away_pitcher: string | null;
  updated_at: string;
}

const MlbDashboard = () => {
  const { toast } = useToast();
  const [predictions, setPredictions] = useState<MlbPredictionDisplay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [generatedDate, setGeneratedDate] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [featuredGame, setFeaturedGame] = useState<ProcessedMlbPrediction | null>(null);
  const [previewGame, setPreviewGame] = useState<ProcessedMlbPrediction | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check user status
  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) {
      try {
        const userData = JSON.parse(u);
        setIsAdmin(userData.is_admin === true);
        setIsPaid(userData.role === "premium" || userData.is_admin === true);
      } catch (e) {
        console.error("Error parsing user data:", e);
      }
    }
  }, []);

  const fetchData = async (skipLoading = false) => {
    if (!skipLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const mlbPredictions = await fetchMlbPredictions();
      
      if (mlbPredictions.length === 0) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      // Find the game with the highest edge to feature
      const featured = findHighestEdgePrediction(mlbPredictions);
      
      // Sort games by game_time_ct to find earliest game
      const sortedByTime = [...mlbPredictions].sort((a, b) => 
        new Date(a.game_time_ct).getTime() - new Date(b.game_time_ct).getTime()
      );
      
      // Set the featured game
      setFeaturedGame(featured || null);
      
      // Set the preview game (earliest game, unless it's the same as featured)
      if (sortedByTime.length > 0) {
        if (featured && sortedByTime[0].matchup_id === featured.matchup_id) {
          // If earliest game is the same as featured, use the next earliest game
          setPreviewGame(sortedByTime.length > 1 ? sortedByTime[1] : null);
        } else {
          // Otherwise use the earliest game
          setPreviewGame(sortedByTime[0]);
        }
      } else {
        setPreviewGame(null);
      }
      
      // Filter out the featured and preview games from regular predictions
      const regularPredictions = mlbPredictions.filter(p => 
        (featured && p.matchup_id === featured.matchup_id) || 
        (previewGame && p.matchup_id === previewGame.matchup_id) ? 
        false : true
      );
      
      // Map the predictions to match the expected MlbPredictionDisplay interface
      const formattedPredictions: MlbPredictionDisplay[] = regularPredictions.map(prediction => ({
        ...prediction,
        game_date: new Date(prediction.game_time_ct).toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      }));
      
      setPredictions(formattedPredictions);
      
      // Set the generated date to today's date
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

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  // Manual refresh handler
  const handleRefresh = () => {
    fetchData(true);
  };

  // Format today's date for display
  const todayFormatted = format(new Date(), "MMM d, yyyy");

  return (
    <AppLayout isAuthenticated={isAuthenticated}>
      <div className="container py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              MLB Predictions
              <span className="text-edge-secondary">Dashboard</span>
            </h1>
            <p className="text-muted-foreground">
              MLB games with predicted odds and market edges
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={h-4 w-4 ${refreshing ? 'animate-spin' : ''}} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
            
            <Button variant="outline" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{generatedDate || todayFormatted}</span>
            </Button>
          </div>
        </div>

        {/* Game of the Day section - visible but lockable */}
        {featuredGame && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-5 w-5 text-edge-secondary" />
              <h2 className="text-xl font-bold">Game of the Day</h2>
            </div>
            <div className="max-w-5xl mx-auto">
              <GameCard 
                {...featuredGame} 
                isAdmin={isAdmin}
                isFeatured={true}
                isPremium={!isPaid && !isAdmin} // Lock for non-premium, non-admin users
              />
            </div>
          </div>
        )}
        
        {/* Preview Game - always accessible to everyone */}
        {previewGame && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-5 w-5" />
              <h2 className="text-xl font-bold">Free Preview Game</h2>
            </div>
            <div className="max-w-5xl mx-auto">
              <GameCard 
                {...previewGame} 
                isAdmin={isAdmin}
                isFeatured={false}
                isPremium={false} // Never locked
              />
            </div>
          </div>
        )}
        
        {/* Show premium banner for non-premium users */}
        {!isPaid && !isAdmin && <PremiumBanner />}
        
        <Alert className="mb-6 bg-muted">
          <Info className="h-4 w-4" />
          <AlertTitle>MLB Predictions</AlertTitle>
          <AlertDescription>
            Using live data from the mlb_predictions table and current market odds.
          </AlertDescription>
        </Alert>

        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="h-10 w-10 animate-spin mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading MLB predictions...</p>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-bold mb-4">All MLB Games</h2>
            {isPaid || isAdmin ? (
              <MlbPredictionsTable predictions={predictions} isLoading={false} />
            ) : (
              <div className="bg-card border rounded-lg p-8 text-center">
                <Lock className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-medium mb-2">Premium Content Locked</h3>
                <p className="text-muted-foreground mb-4">
                  Upgrade to a premium account to see all MLB predictions and detailed analytics.
                </p>
                <Button onClick={() => window.location.href = "/pricing"}>
                  Upgrade Now
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 p-4 border rounded-lg bg-card">
          <h3 className="font-medium mb-2">Legend</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 bg-edge-mlb rounded-full"></div>
                <span className="text-sm font-medium">MLB</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <div className="flex items-center gap-1 mb-1">
                <p><strong>Predicted Odds:</strong> From mlb_predictions.moneyline</p>
              </div>
              <p><strong>Market/Predicted Implied %:</strong> Conversion from odds to win probability</p>
              <p><strong>Edge %:</strong> Difference between predicted and market implied percentages</p>
            </div>
            <div className="text-xs text-muted-foreground">
              <p>Last updated: {generatedDate || todayFormatted}</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default MlbDashboard;
