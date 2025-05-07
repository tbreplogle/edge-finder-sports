
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Code, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PredictionLogicViewer } from "@/components/admin/PredictionLogicViewer";
import { PredictionDataPreview } from "@/components/admin/PredictionDataPreview";
import { PredictionFilters, FilterValues } from "@/components/admin/PredictionFilters";
import { PredictionStats } from "@/components/admin/PredictionStats";
import { PredictionsTable } from "@/components/admin/PredictionsTable";
import { MlbTeamHittingDataSection } from "@/components/admin/tables/MlbTeamHittingDataSection";

// Define a custom type for our frontend prediction display
interface PredictionDisplay {
  id?: string;
  sport: string;
  home_team: string;
  away_team: string;
  game_id?: string;
  game_date: string;
  predicted_margin?: number;
  edge?: number;
  home_ml?: number;
  away_ml?: number;
  market_home_ml?: number;
  market_away_ml?: number;
  updated_at: string;
}

const AdminPreview = () => {
  const [predictions, setPredictions] = useState<PredictionDisplay[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [filters, setFilters] = useState<FilterValues>({
    sport: "all",
    dateSince: "week"
  });
  
  const navigate = useNavigate();
  
  const fetchPredictions = async () => {
    setIsLoading(true);
    
    try {
      // For MLB predictions, query mlb_matchups table and join with mlb_predictions
      if (filters.sport.toLowerCase() === "mlb" || filters.sport === "all") {
        let query = supabase
          .from("mlb_matchups")
          .select(`
            matchup_id,
            game_id,
            game_date,
            home_team,
            away_team,
            home_team_id,
            away_team_id
          `)
          .order("game_date", { ascending: false });
        
        // Apply date filter
        const now = new Date();
        if (filters.dateSince === "today") {
          const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
          query = query.gte("game_date", todayStart);
        } else if (filters.dateSince === "yesterday") {
          const yesterdayStart = new Date(now);
          yesterdayStart.setDate(yesterdayStart.getDate() - 1);
          yesterdayStart.setHours(0, 0, 0, 0);
          query = query.gte("game_date", yesterdayStart.toISOString());
        } else if (filters.dateSince === "week") {
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          query = query.gte("game_date", weekAgo.toISOString());
        } else if (filters.dateSince === "month") {
          const monthAgo = new Date(now);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          query = query.gte("game_date", monthAgo.toISOString());
        }
        
        const { data: matchupsData, error: matchupsError } = await query;
        
        if (matchupsError) {
          throw matchupsError;
        }
        
        if (matchupsData && matchupsData.length > 0) {
          // Next, get the predictions for these matchups
          const { data: predictionsData, error: predictionsError } = await supabase
            .from("mlb_predictions")
            .select("*");
          
          if (predictionsError) {
            throw predictionsError;
          }
          
          // Group predictions by matchup_id
          const predictionsByMatchup = new Map();
          if (predictionsData) {
            predictionsData.forEach(prediction => {
              if (!predictionsByMatchup.has(prediction.matchup_id)) {
                predictionsByMatchup.set(prediction.matchup_id, []);
              }
              predictionsByMatchup.get(prediction.matchup_id).push(prediction);
            });
          }
          
          // Transform the data to match our PredictionDisplay interface
          const mlbPredictions: PredictionDisplay[] = matchupsData.map((matchup) => {
            const matchupPredictions = predictionsByMatchup.get(matchup.matchup_id) || [];
            
            // Find home and away team predictions
            const homePrediction = matchupPredictions.find(p => p && p.team_id === matchup.home_team_id);
            const awayPrediction = matchupPredictions.find(p => p && p.team_id === matchup.away_team_id);
            
            // Calculate predicted margin (home team perspective)
            let predictedMargin: number | undefined = undefined;
            if (homePrediction && awayPrediction && homePrediction.win_pct !== null && awayPrediction.win_pct !== null) {
              predictedMargin = (homePrediction.win_pct - awayPrediction.win_pct) * 10;
            }
            
            // Latest update timestamp from predictions
            // Fix: Ensure we're working with string timestamps consistently
            let latestUpdate = new Date().toISOString();
            
            if (matchupPredictions.length > 0) {
              // Initialize with the first prediction's timestamp or current time if not available
              latestUpdate = matchupPredictions[0]?.created_at || new Date().toISOString();
              
              // Find the latest timestamp
              for (let i = 1; i < matchupPredictions.length; i++) {
                const prediction = matchupPredictions[i];
                if (prediction && prediction.created_at && prediction.created_at > latestUpdate) {
                  latestUpdate = prediction.created_at;
                }
              }
            }
            
            return {
              id: matchup.matchup_id,
              sport: "MLB",
              game_id: matchup.game_id,
              game_date: matchup.game_date,
              home_team: matchup.home_team,
              away_team: matchup.away_team,
              predicted_margin: predictedMargin,
              home_ml: homePrediction?.moneyline,
              away_ml: awayPrediction?.moneyline,
              updated_at: latestUpdate
            };
          });
          
          setPredictions(mlbPredictions);
        } else {
          setPredictions([]);
        }
      } else {
        // For other sports (to be implemented)
        setPredictions([]);
      }
    } catch (error: any) {
      console.error("Error fetching predictions:", error);
      toast.error("Failed to fetch predictions");
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchPredictions();
  }, []);
  
  const handleFilterChange = (key: keyof FilterValues, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  const applyFilters = () => {
    fetchPredictions();
  };
  
  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Admin Preview</h1>
            <p className="text-muted-foreground">
              Preview and analyze prediction data and logic
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/admin/logic')}
              className="flex items-center gap-2"
            >
              <Code className="h-4 w-4" />
              Advanced Logic
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="predictions" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="predictions">Predictions</TabsTrigger>
            <TabsTrigger value="data-preview">Data Preview</TabsTrigger>
            <TabsTrigger value="logic">Prediction Logic</TabsTrigger>
            <TabsTrigger value="mlb-stats">MLB Stats</TabsTrigger>
          </TabsList>
          
          <TabsContent value="predictions" className="space-y-6">
            <PredictionFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              onApplyFilters={applyFilters}
              isLoading={isLoading}
            />
            
            <PredictionStats predictions={predictions} />
            
            <PredictionsTable
              predictions={predictions}
              isLoading={isLoading}
            />
          </TabsContent>
          
          <TabsContent value="data-preview">
            <PredictionDataPreview sport={filters.sport} />
          </TabsContent>
          
          <TabsContent value="logic">
            <PredictionLogicViewer sport={filters.sport} />
          </TabsContent>
          
          <TabsContent value="mlb-stats">
            <MlbTeamHittingDataSection />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AdminPreview;
