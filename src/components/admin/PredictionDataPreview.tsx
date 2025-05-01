
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, FileText, Download } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamStats, Matchup, PitcherStats } from "@/lib/formulas/mlbPredict";
import { toast } from "sonner";

interface PredictionDataPreviewProps {
  sport: string;
}

// Mock function to get MLB team stats - in a real app, this would come from the API
const getMockMlbData = async (): Promise<{
  teamStats: Record<string, TeamStats>;
  matchups: Matchup[];
  pitchers: Record<string, PitcherStats>;
}> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Sample mock data
  const teamStats: Record<string, TeamStats> = {
    "NYY": { team: "NYY", HR: 35, HRA: 28, BA: 0.267 },
    "BOS": { team: "BOS", HR: 30, HRA: 32, BA: 0.255 },
    "TB": { team: "TB", HR: 27, HRA: 26, BA: 0.248 },
    "LAD": { team: "LAD", HR: 40, HRA: 24, BA: 0.275 },
    "SF": { team: "SF", HR: 29, HRA: 30, BA: 0.252 }
  };
  
  const pitchers: Record<string, PitcherStats> = {
    "685100_home": {
      game_id: "685100",
      team: "LAD",
      ERAplus: 120,
      WHIP: 1.05
    },
    "685100_away": {
      game_id: "685100",
      team: "SF",
      ERAplus: 95,
      WHIP: 1.32
    },
    "685101_home": {
      game_id: "685101",
      team: "NYY",
      ERAplus: 115,
      WHIP: 1.15
    },
    "685101_away": {
      game_id: "685101",
      team: "BOS",
      ERAplus: 97,
      WHIP: 1.28
    }
  };
  
  const matchups: Matchup[] = [
    {
      game_id: "685100",
      home: "LAD",
      away: "SF",
      pitcher_home: pitchers["685100_home"],
      pitcher_away: pitchers["685100_away"]
    },
    {
      game_id: "685101",
      home: "NYY",
      away: "BOS",
      pitcher_home: pitchers["685101_home"],
      pitcher_away: pitchers["685101_away"]
    }
  ];
  
  return { teamStats, matchups, pitchers };
};

export function PredictionDataPreview({ sport }: PredictionDataPreviewProps) {
  const [activeDataTab, setActiveDataTab] = useState<string>("teamStats");
  const [data, setData] = useState<{
    teamStats: Record<string, TeamStats>;
    matchups: Matchup[];
    pitchers: Record<string, PitcherStats>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const normalizedSport = sport === "all" ? "mlb" : sport.toLowerCase();
  
  // Load the data for the selected sport
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        if (normalizedSport === "mlb") {
          const mlbData = await getMockMlbData();
          setData(mlbData);
        } else {
          setData(null);
          setError(`Data preview not available for ${normalizedSport.toUpperCase()}`);
        }
      } catch (err: any) {
        console.error("Error loading prediction data:", err);
        setError(err.message || "Failed to load prediction data");
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [normalizedSport]);

  // Function to refresh the data
  const refreshData = async () => {
    try {
      setIsLoading(true);
      
      if (normalizedSport === "mlb") {
        const mlbData = await getMockMlbData();
        setData(mlbData);
        toast.success("Data refreshed successfully");
      }
    } catch (err: any) {
      console.error("Error refreshing data:", err);
      toast.error("Failed to refresh data", {
        description: err.message || "An unexpected error occurred"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to export the data as JSON
  const exportData = () => {
    if (!data) return;
    
    try {
      let exportObject;
      
      switch (activeDataTab) {
        case "teamStats":
          exportObject = data.teamStats;
          break;
        case "matchups":
          exportObject = data.matchups;
          break;
        case "pitchers":
          exportObject = data.pitchers;
          break;
        default:
          exportObject = data;
      }
      
      const jsonString = JSON.stringify(exportObject, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${normalizedSport}-${activeDataTab}.json`;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
      
    } catch (err) {
      console.error("Error exporting data:", err);
      toast.error("Failed to export data");
    }
  };

  // Renders for different data types
  const renderTeamStatsTable = () => {
    if (!data?.teamStats) return null;
    
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">HR</TableHead>
              <TableHead className="text-right">HR Allowed</TableHead>
              <TableHead className="text-right">Batting Avg</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.values(data.teamStats).map((team) => (
              <TableRow key={team.team}>
                <TableCell className="font-medium">{team.team}</TableCell>
                <TableCell className="text-right">{team.HR}</TableCell>
                <TableCell className="text-right">{team.HRA}</TableCell>
                <TableCell className="text-right">{team.BA.toFixed(3)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };
  
  const renderMatchupsTable = () => {
    if (!data?.matchups) return null;
    
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Game ID</TableHead>
              <TableHead>Away Team</TableHead>
              <TableHead>Home Team</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.matchups.map((matchup) => (
              <TableRow key={matchup.game_id}>
                <TableCell className="font-mono text-xs">{matchup.game_id}</TableCell>
                <TableCell>{matchup.away}</TableCell>
                <TableCell>{matchup.home}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };
  
  const renderPitchersTable = () => {
    if (!data?.pitchers) return null;
    
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Game ID</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">ERA+</TableHead>
              <TableHead className="text-right">WHIP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.values(data.pitchers).map((pitcher) => (
              <TableRow key={`${pitcher.game_id}_${pitcher.team}`}>
                <TableCell className="font-mono text-xs">{pitcher.game_id}</TableCell>
                <TableCell>{pitcher.team}</TableCell>
                <TableCell className="text-right">{pitcher.ERAplus}</TableCell>
                <TableCell className="text-right">{pitcher.WHIP.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const getDataTabContent = () => {
    if (isLoading) {
      return (
        <div className="p-4 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }
    
    if (error) {
      return (
        <Alert>
          <AlertTitle>No Data Available</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }
    
    switch (activeDataTab) {
      case "teamStats":
        return renderTeamStatsTable();
      case "matchups":
        return renderMatchupsTable();
      case "pitchers":
        return renderPitchersTable();
      default:
        return (
          <Alert>
            <AlertTitle>Invalid Selection</AlertTitle>
            <AlertDescription>Please select a valid data type</AlertDescription>
          </Alert>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Source Data Preview</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={refreshData}
            disabled={isLoading || !!error}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          
          <Button
            variant="outline"
            onClick={exportData}
            disabled={isLoading || !!error}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>
      
      {normalizedSport !== "mlb" && !isLoading && (
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertTitle>Limited Preview</AlertTitle>
          <AlertDescription>
            Currently, only MLB data preview is fully implemented. Other sports coming soon.
          </AlertDescription>
        </Alert>
      )}
      
      <Tabs
        defaultValue="teamStats"
        value={activeDataTab}
        onValueChange={setActiveDataTab}
        className="w-full"
      >
        <TabsList className="mb-4">
          <TabsTrigger value="teamStats">Team Stats</TabsTrigger>
          <TabsTrigger value="matchups">Matchups</TabsTrigger>
          <TabsTrigger value="pitchers">Pitchers</TabsTrigger>
        </TabsList>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              {activeDataTab === 'teamStats' 
                ? 'Team Statistics' 
                : activeDataTab === 'matchups'
                  ? 'Game Matchups'
                  : 'Pitcher Statistics'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {getDataTabContent()}
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
