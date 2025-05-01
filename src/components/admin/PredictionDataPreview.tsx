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
import { supabase } from "@/integrations/supabase/client";

interface PredictionDataPreviewProps {
  sport: string;
}

// League options for selection
const LEAGUE_OPTIONS = [
  { value: "mlb", label: "MLB" },
  { value: "nfl", label: "NFL" },
  { value: "ncaaf", label: "NCAAF" },
  { value: "ncaab", label: "NCAAB" }
];

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
    fetchLeagueData();
  }, [selectedLeague]);

  // Function to fetch data from the database
  const fetchLeagueData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      let teamStats: Record<string, TeamStats> = {};
      let matchups: Matchup[] = [];
      let pitchers: Record<string, PitcherStats> = {};
      
      if (selectedLeague === "mlb") {
        // Fetch MLB team stats
        const { data: teamData, error: teamError } = await supabase.rpc('get_mlb_team_stats');
        
        if (teamError) throw teamError;
        
        if (teamData && Array.isArray(teamData) && teamData.length > 0) {
          teamStats = teamData.reduce((acc: Record<string, TeamStats>, team: any) => {
            acc[team.team] = {
              team: team.team,
              HR: team.hr || 0,
              HRA: team.hra || 0, 
              BA: team.ba || 0
            };
            return acc;
          }, {});
        }
        
        // Fetch MLB matchups and pitchers
        const { data: matchupData, error: matchupError } = await supabase.rpc('get_mlb_matchups');
        
        if (matchupError) throw matchupError;
        
        if (matchupData && Array.isArray(matchupData) && matchupData.length > 0) {
          matchups = matchupData;
          
          // Extract pitcher data from matchups
          pitchers = matchupData.reduce((acc: Record<string, PitcherStats>, game: any) => {
            if (game.pitcher_home) {
              acc[`${game.game_id}_home`] = game.pitcher_home;
            }
            if (game.pitcher_away) {
              acc[`${game.game_id}_away`] = game.pitcher_away;
            }
            return acc;
          }, {});
        }
      } else if (selectedLeague === "nfl") {
        // Fetch NFL data
        const { data: nflData, error: nflError } = await supabase.rpc('get_nfl_data');
        
        if (nflError) throw nflError;
        
        if (nflData) {
          // Process NFL data
          if (nflData.team_stats) {
            teamStats = nflData.team_stats;
          }
          if (nflData.matchups) {
            matchups = nflData.matchups;
          }
        }
      }
      
      // If we don't have any real data, use empty objects/arrays to avoid errors
      setData({
        teamStats: Object.keys(teamStats).length > 0 ? teamStats : {}, 
        matchups: matchups.length > 0 ? matchups : [],
        pitchers: Object.keys(pitchers).length > 0 ? pitchers : {}
      });
      
      // If we don't have any data, show a message
      if (Object.keys(teamStats).length === 0 && matchups.length === 0) {
        setError(`No ${selectedLeague.toUpperCase()} data currently available in the database. Run the prediction pipeline to see live data.`);
      }
    } catch (err: any) {
      console.error(`Error loading ${selectedLeague} prediction data:`, err);
      setError(err.message || `Failed to load ${selectedLeague.toUpperCase()} prediction data`);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to refresh the data
  const refreshData = async () => {
    try {
      setIsLoading(true);
      await fetchLeagueData();
      toast.success("Data refreshed successfully");
    } catch (err: any) {
      console.error(`Error refreshing ${selectedLeague} data:`, err);
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
    if (!data?.teamStats || Object.keys(data.teamStats).length === 0) {
      return (
        <Alert>
          <AlertTitle>No Team Data Available</AlertTitle>
          <AlertDescription>No MLB team stats available in the database. Run the prediction pipeline to generate data.</AlertDescription>
        </Alert>
      );
    }
    
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
                <TableCell className="text-right">{team.BA?.toFixed(3) || "0.000"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };
  
  const renderMlbMatchupsTable = () => {
    if (!data?.matchups || data.matchups.length === 0) {
      return (
        <Alert>
          <AlertTitle>No Matchup Data Available</AlertTitle>
          <AlertDescription>No MLB matchups available in the database. Run the prediction pipeline to generate data.</AlertDescription>
        </Alert>
      );
    }
    
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Game ID</TableHead>
              <TableHead>Away Team</TableHead>
              <TableHead>Home Team</TableHead>
              <TableHead className="text-right">Moneyline H/A</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.matchups.map((matchup: Matchup) => (
              <TableRow key={matchup.game_id}>
                <TableCell className="font-mono text-xs">{matchup.game_id}</TableCell>
                <TableCell>{matchup.away}</TableCell>
                <TableCell>{matchup.home}</TableCell>
                <TableCell className="text-right">
                  {matchup.moneyline ? matchup.moneyline : "-"} / {matchup.moneyline_opponent ? matchup.moneyline_opponent : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };
  
  const renderMlbPitchersTable = () => {
    if (!data?.pitchers || Object.keys(data.pitchers).length === 0) {
      return (
        <Alert>
          <AlertTitle>No Pitcher Data Available</AlertTitle>
          <AlertDescription>No MLB pitcher stats available in the database. Run the prediction pipeline to generate data.</AlertDescription>
        </Alert>
      );
    }
    
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
    if (!data?.teamStats || Object.keys(data.teamStats).length === 0) {
      return (
        <Alert>
          <AlertTitle>No Team Data Available</AlertTitle>
          <AlertDescription>No NFL team stats available in the database. Run the prediction pipeline to generate data.</AlertDescription>
        </Alert>
      );
    }
    
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
    if (!data?.matchups || data.matchups.length === 0) {
      return (
        <Alert>
          <AlertTitle>No Matchup Data Available</AlertTitle>
          <AlertDescription>No NFL matchups available in the database. Run the prediction pipeline to generate data.</AlertDescription>
        </Alert>
      );
    }
    
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
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          
          <Button
            variant="outline"
            onClick={exportData}
            disabled={isLoading || !!error || !data}
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
