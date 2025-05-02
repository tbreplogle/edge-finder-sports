
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

const AdminPreview = () => {
  const [predictions, setPredictions] = useState<Tables<"predictions">[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [filters, setFilters] = useState<FilterValues>({
    sport: "all",
    dateSince: "week"
  });
  
  const navigate = useNavigate();
  
  const fetchPredictions = async () => {
    setIsLoading(true);
    
    try {
      let query = supabase
        .from("predictions")
        .select("*")
        .order("updated_at", { ascending: false });
        
      // Apply filters
      if (filters.sport !== "all") {
        query = query.eq("sport", filters.sport.toUpperCase());
      }
      
      // Apply date filter
      const now = new Date();
      if (filters.dateSince === "today") {
        const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        query = query.gte("updated_at", todayStart);
      } else if (filters.dateSince === "yesterday") {
        const yesterdayStart = new Date(now);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        yesterdayStart.setHours(0, 0, 0, 0);
        query = query.gte("updated_at", yesterdayStart.toISOString());
      } else if (filters.dateSince === "week") {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte("updated_at", weekAgo.toISOString());
      } else if (filters.dateSince === "month") {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        query = query.gte("updated_at", monthAgo.toISOString());
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      setPredictions(data || []);
    } catch (error: any) {
      console.error("Error fetching predictions:", error);
      toast.error("Failed to fetch predictions");
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
