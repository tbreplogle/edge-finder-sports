
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MlbTeamHittingStatsTable } from "./MlbTeamHittingStatsTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MlbTeamHittingDataSection() {
  const [stats, setStats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchTeamHittingStats = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('mlb_team_hitting_stats')
        .select('*')
        .order('team_name', { ascending: true });
        
      if (error) {
        throw new Error(error.message);
      }
      
      if (data && data.length > 0) {
        setStats(data);
        
        // Get the most recent update timestamp
        const latestDate = new Date(
          Math.max(...data.map(d => new Date(d.created_at || d.game_date).getTime()))
        ).toISOString();
        setLastUpdated(latestDate);
      } else {
        setStats([]);
        setError("No MLB team hitting stats found. The daily update workflow may not have run yet.");
      }
    } catch (err: any) {
      console.error("Error fetching MLB team hitting stats:", err);
      setError(`Failed to load MLB team hitting stats: ${err.message}`);
      setStats([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchTeamHittingStats();
  }, []);
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">MLB Team Hitting Statistics</h2>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground flex items-center">
              <Calendar className="h-3 w-3 mr-1" />
              Updated: {new Date(lastUpdated).toLocaleString()}
            </span>
          )}
        </div>
      </div>
      
      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Data Fetch Error</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{error}</p>
            <div className="pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchTeamHittingStats}
              >
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <MlbTeamHittingStatsTable 
          stats={stats} 
          isLoading={isLoading}
          lastUpdated={lastUpdated || undefined}
          onRefresh={fetchTeamHittingStats}
        />
      )}
    </div>
  );
}
