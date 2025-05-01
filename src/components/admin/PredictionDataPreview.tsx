
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PredictionDataPreviewProps {
  sport: string;
}

// Mock data for different leagues
const LEAGUE_OPTIONS = [
  { value: "mlb", label: "MLB" },
  { value: "nfl", label: "NFL" },
  { value: "ncaaf", label: "NCAAF" },
  { value: "ncaab", label: "NCAAB" }
];

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

// Mock NFL data
const getMockNflData = async () => {
  await new Promise(resolve => setTimeout(resolve, 800));
  return {
    teamStats: {
      "KC": { team: "KC", pointsFor: 28.2, pointsAgainst: 17.3, ydsPerGame: 401 },
      "SF": { team: "SF", pointsFor: 26.5, pointsAgainst: 18.1, ydsPerGame: 389 },
      "BUF": { team: "BUF", pointsFor: 27.1, pointsAgainst: 19.2, ydsPerGame: 375 },
      "DAL": { team: "DAL", pointsFor: 25.8, pointsAgainst: 20.3, ydsPerGame: 362 }
    },
    matchups: [
      { game_id: "123001", home: "KC", away: "BUF" },
      { game_id: "123002", home: "SF", away: "DAL" }
    ]
  };
};

export function PredictionDataPreview({ sport }: PredictionDataPreviewProps) {
  const [activeDataTab, setActiveDataTab] = useState<string>("teamStats");
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<string>("mlb");

  // Use sport prop as initial value for selectedLeague if valid
  useEffect(() => {
    if (sport && sport !== 'all' && LEAGUE_OPTIONS.some(option => option.value === sport.toLowerCase())) {
      setSelectedLeague(sport.toLowerCase());
    }
  }, [sport]);
  
  // Load the data for the selected league
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        let leagueData = null;
        
        switch (selectedLeague) {
          case "mlb":
            leagueData = await getMockMlbData();
            break;
          case "nfl":
            leagueData = await getMockNflData();
            break;
          default:
            setError(`Data preview not available for ${selectedLeague.toUpperCase()}`);
            break;
        }
        
        setData(leagueData);
      } catch (err: any) {
        console.error("Error loading prediction data:", err);
        setError(err.message || "Failed to load prediction data");
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [selectedLeague]);

  // Function to refresh the data
  const refreshData = async () => {
    try {
      setIsLoading(true);
      
      let leagueData = null;
        
      switch (selectedLeague) {
        case "mlb":
          leagueData = await getMockMlbData();
          break;
        case "nfl":
          leagueData = await getMockNflData();
          break;
      }
      
      setData(leagueData);
      toast.success("Data refreshed successfully");
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
      a.download = `${selectedLeague}-${activeDataTab}.json`;
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

  // Renders for different data types based on league
  const renderDataContent = () => {
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
    
    if (!data) {
      return (
        <Alert>
          <AlertTitle>No Data Available</AlertTitle>
          <AlertDescription>No data available for {selectedLeague.toUpperCase()}</AlertDescription>
        </Alert>
      );
    }
    
    // Render MLB data
    if (selectedLeague === "mlb") {
      switch (activeDataTab) {
        case "teamStats":
          return renderMlbTeamStatsTable();
        case "matchups":
          return renderMlbMatchupsTable();
        case "pitchers":
          return renderMlbPitchersTable();
        default:
          return (
            <Alert>
              <AlertTitle>Invalid Selection</AlertTitle>
              <AlertDescription>Please select a valid data type</AlertDescription>
            </Alert>
          );
      }
    }
    
    // Render NFL data
    if (selectedLeague === "nfl") {
      switch (activeDataTab) {
        case "teamStats":
          return renderNflTeamStatsTable();
        case "matchups":
          return renderNflMatchupsTable();
        default:
          return (
            <Alert>
              <AlertTitle>Invalid Selection</AlertTitle>
              <AlertDescription>Please select a valid data type</AlertDescription>
            </Alert>
          );
      }
    }
    
    return (
      <Alert>
        <AlertTitle>Unsupported League</AlertTitle>
        <AlertDescription>Data display not implemented for {selectedLeague.toUpperCase()}</AlertDescription>
      </Alert>
    );
  };

  // MLB-specific renderers
  const renderMlbTeamStatsTable = () => {
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
            {Object.values(data.teamStats).map((team: TeamStats) => (
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
  
  const renderMlbMatchupsTable = () => {
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
            {data.matchups.map((matchup: Matchup) => (
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
  
  const renderMlbPitchersTable = () => {
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
            {Object.values(data.pitchers).map((pitcher: PitcherStats) => (
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

  // NFL-specific renderers
  const renderNflTeamStatsTable = () => {
    if (!data?.teamStats) return null;
    
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">Pts For</TableHead>
              <TableHead className="text-right">Pts Against</TableHead>
              <TableHead className="text-right">Yds/Game</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.values(data.teamStats).map((team: any) => (
              <TableRow key={team.team}>
                <TableCell className="font-medium">{team.team}</TableCell>
                <TableCell className="text-right">{team.pointsFor}</TableCell>
                <TableCell className="text-right">{team.pointsAgainst}</TableCell>
                <TableCell className="text-right">{team.ydsPerGame}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };
  
  const renderNflMatchupsTable = () => {
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
            {data.matchups.map((matchup: any) => (
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

  // Get appropriate tab options based on selected league
  const getTabOptions = () => {
    switch (selectedLeague) {
      case "mlb":
        return (
          <TabsList className="mb-4">
            <TabsTrigger value="teamStats">Team Stats</TabsTrigger>
            <TabsTrigger value="matchups">Matchups</TabsTrigger>
            <TabsTrigger value="pitchers">Pitchers</TabsTrigger>
          </TabsList>
        );
      case "nfl":
      case "ncaaf":
        return (
          <TabsList className="mb-4">
            <TabsTrigger value="teamStats">Team Stats</TabsTrigger>
            <TabsTrigger value="matchups">Matchups</TabsTrigger>
          </TabsList>
        );
      default:
        return (
          <TabsList className="mb-4">
            <TabsTrigger value="teamStats">Team Stats</TabsTrigger>
          </TabsList>
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
      
      {/* League selector */}
      <div className="flex items-center space-x-4">
        <label className="text-sm text-muted-foreground">League:</label>
        <Select
          value={selectedLeague}
          onValueChange={setSelectedLeague}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Select league" />
          </SelectTrigger>
          <SelectContent>
            {LEAGUE_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {(!["mlb", "nfl"].includes(selectedLeague)) && !isLoading && (
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertTitle>Limited Preview</AlertTitle>
          <AlertDescription>
            Currently, only MLB and NFL data preview are fully implemented. Other sports coming soon.
          </AlertDescription>
        </Alert>
      )}
      
      <Tabs
        defaultValue="teamStats"
        value={activeDataTab}
        onValueChange={setActiveDataTab}
        className="w-full"
      >
        {getTabOptions()}
        
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
            {renderDataContent()}
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
