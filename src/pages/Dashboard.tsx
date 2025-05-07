import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { LiveScores } from "@/components/LiveScores";
import { FeaturedGame } from "@/components/FeaturedGame";
import { SportTabs } from "@/components/SportTabs";
import { CalendarIcon, ArrowDownUp } from "lucide-react";
import { GameCard } from "@/components/GameCard";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { fetchMlbPredictions, ProcessedMlbPrediction } from "@/utils/fetchMlbPredictions";
import { fetchOdds } from "@/utils/oddsApi";
import { toast } from "sonner";

// Define a type for our game data structure
interface GameData {
  id: string;
  sport: "nfl" | "ncaaf" | "ncaab" | "mlb";
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  marketSpread: number;
  predictedMargin: number | null;
  edge: number | null;
  confidence?: number | null;
  isPremium?: boolean;
  rawFactors?: Record<string, any> | null;
  isPreviewGame?: boolean;
  homeMoneyline?: number | null;
  awayMoneyline?: number | null;
}

// Sample fake data to show while loading or if no real data
const sampleGames: GameData[] = [
  {
    id: "1",
    sport: "nfl",
    homeTeam: "Chiefs",
    awayTeam: "Eagles",
    startTime: "2024-09-08T19:20:00",
    marketSpread: 2.5,
    predictedMargin: 3.1,
    edge: 1.2,
    confidence: 65,
    isPremium: true,
    rawFactors: {
      offense: 88,
      defense: 92,
      specialTeams: 75
    }
  },
  {
    id: "2",
    sport: "ncaaf",
    homeTeam: "Alabama",
    awayTeam: "Georgia",
    startTime: "2024-09-14T15:30:00",
    marketSpread: -3.5,
    predictedMargin: -2.8,
    edge: 0.9,
    confidence: 58,
    isPremium: false,
    rawFactors: {
      offense: 90,
      defense: 85,
      specialTeams: 80
    }
  },
  {
    id: "3",
    sport: "ncaab",
    homeTeam: "Duke",
    awayTeam: "UNC",
    startTime: "2024-11-28T21:00:00",
    marketSpread: 5.5,
    predictedMargin: 6.2,
    edge: 1.5,
    confidence: 70,
    isPremium: true,
    rawFactors: {
      offense: 92,
      defense: 88,
      specialTeams: 85
    }
  },
  {
    id: "4",
    sport: "mlb",
    homeTeam: "Yankees",
    awayTeam: "Red Sox",
    startTime: "2024-07-04T13:00:00",
    marketSpread: 0,
    predictedMargin: 1.8,
    edge: 0.7,
    confidence: 55,
    isPremium: false,
    rawFactors: {
      hitting: 85,
      pitching: 90,
      fielding: 82
    }
  }
];

const Dashboard = () => {
  const [activeSport, setActiveSport] = useState<string>("mlb");
  const [games, setGames] = useState<GameData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isPremium, setIsPremium] = useState<boolean>(false);

  useEffect(() => {
    // Check authentication status from localStorage
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setIsAuthenticated(true);
        setIsPremium(user.role === "premium" || user.is_admin === true);
      } catch (e) {
        console.error("Error parsing user data:", e);
      }
    }

    // If the active sport is MLB, fetch MLB predictions
    if (activeSport === "mlb") {
      fetchMlbData();
    } else {
      // For other sports, load sample data for now
      const sportGames = sampleGames.filter(game => game.sport === activeSport);
      setGames(sortGames(sportGames));
      setLoading(false);
    }
  }, [activeSport]);

  const fetchMlbData = async () => {
    setLoading(true);
    try {
      const mlbPredictions = await fetchMlbPredictions();
      
      // Convert processed MLB predictions to our GameData format
      const mlbGames: GameData[] = mlbPredictions.map(prediction => ({
        id: prediction.matchup_id,
        sport: "mlb",
        homeTeam: prediction.home_team,
        awayTeam: prediction.away_team,
        startTime: prediction.game_date,
        marketSpread: 0, // MLB doesn't use spread
        predictedMargin: null, // We'll use moneyline instead
        edge: prediction.edge_pct ? prediction.edge_pct * 100 : null, // Convert to percentage points
        confidence: prediction.predicted_implied_pct ? Math.round(prediction.predicted_implied_pct * 100) : null,
        isPremium: Math.abs(prediction.edge_pct || 0) > 0.02, // Make edges > 2% premium
        homeMoneyline: prediction.moneyline,
        awayMoneyline: null, // This would need to come from another source
        marketMoneyline: prediction.market_ml
      }));
      
      setGames(sortGames(mlbGames));
    } catch (error) {
      console.error("Error fetching MLB predictions:", error);
      toast.error("Failed to load predictions");
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (sport: string) => {
    setActiveSport(sport);
  };

  const sortGames = (gamesToSort: GameData[]) => {
    return [...gamesToSort].sort((a, b) => {
      const edgeA = Math.abs(a.edge || 0);
      const edgeB = Math.abs(b.edge || 0);
      
      return sortOrder === "desc" ? edgeB - edgeA : edgeA - edgeB;
    });
  };

  const handleToggleSort = () => {
    const newOrder = sortOrder === "asc" ? "desc" : "asc";
    setSortOrder(newOrder);
    setGames(sortGames(games));
  };

  // Used to create a "free preview" game
  const getPreviewGame = () => {
    const filtered = games.filter(g => !g.isPreviewGame);
    if (filtered.length === 0) return null;
    
    // Sort by edge to get the highest edge game
    const sorted = [...filtered].sort((a, b) => Math.abs(b.edge || 0) - Math.abs(a.edge || 0));
    return {
      ...sorted[0],
      isPreviewGame: true,
      isPremium: false
    };
  };

  const previewGame = getPreviewGame();
  const filteredGames = games.filter(g => !g.isPreviewGame);

  // Format today's date
  const todaysDate = format(new Date(), "EEEE, MMMM d");

  return (
    <AppLayout>
      <div className="container mx-auto py-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <h1 className="text-3xl font-bold mb-2">Today's Predictions</h1>
            <div className="flex items-center text-muted-foreground mb-4">
              <CalendarIcon className="mr-2 h-4 w-4" />
              <span>{todaysDate}</span>
            </div>
            
            <div className="space-y-6">
              <SportTabs activeTab={activeSport} onTabChange={handleTabChange} />
              
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">
                  {activeSport.toUpperCase()} Games
                </h2>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleToggleSort}
                  className="flex items-center gap-2"
                >
                  <ArrowDownUp className="h-4 w-4" />
                  Sort by {sortOrder === "desc" ? "Highest" : "Lowest"} Edge
                </Button>
              </div>
              
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-40 bg-muted rounded-lg animate-pulse"></div>
                  ))}
                </div>
              ) : (
                <>
                  {!isAuthenticated && (
                    <div className="p-4 mb-4 bg-muted rounded-lg">
                      <h3 className="font-medium mb-1">Preview Mode</h3>
                      <p className="text-sm text-muted-foreground">
                        You're viewing in guest preview mode. One game per sport is shown with full details.{' '}
                        <a href="/auth/login" className="text-primary underline">Sign in</a> or{' '}
                        <a href="/auth/register" className="text-primary underline">create an account</a> to see all predictions.
                      </p>
                    </div>
                  )}
                  
                  {previewGame && !isAuthenticated && (
                    <div className="mb-4">
                      <h3 className="font-medium mb-2">Preview Game</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        The first game below shows full premium details as a preview. Create an account to access all predictions.
                      </p>
                      <GameCard 
                        key={previewGame.id + "-preview"} 
                        {...previewGame} 
                      />
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredGames.map(game => (
                      <GameCard 
                        key={game.id} 
                        {...game} 
                        isPremium={!isPremium && game.isPremium}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="space-y-6">
            <FeaturedGame />
            <LiveScores />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
