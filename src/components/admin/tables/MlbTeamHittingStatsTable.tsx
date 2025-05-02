
import { useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tables } from "@/integrations/supabase/types";

type TeamHittingStats = Tables<"mlb_team_hitting_stats">;

interface MlbTeamHittingStatsTableProps {
  stats: TeamHittingStats[];
  isLoading?: boolean;
}

export function MlbTeamHittingStatsTable({ stats, isLoading = false }: MlbTeamHittingStatsTableProps) {
  const [timeframe, setTimeframe] = useState<"7" | "14">("7");
  
  // Filter stats by timeframe
  const filteredStats = stats.filter(stat => stat.timeframe_days === parseInt(timeframe, 10));
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Team Hitting Stats</h2>
          <div className="animate-pulse bg-gray-200 h-8 w-28 rounded"></div>
        </div>
        <div className="animate-pulse space-y-2">
          {Array(10).fill(0).map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }
  
  if (!stats || stats.length === 0) {
    return (
      <Alert>
        <AlertTitle>No Team Hitting Data Available</AlertTitle>
        <AlertDescription>
          No MLB team hitting stats available. Run the scraper workflow to generate data.
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Team Hitting Stats</h2>
        <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as "7" | "14")}>
          <TabsList>
            <TabsTrigger value="7">7 Days</TabsTrigger>
            <TabsTrigger value="14">14 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">GP</TableHead>
              <TableHead className="text-right">HR</TableHead>
              <TableHead className="text-right">AVG</TableHead>
              <TableHead className="text-right">OBP</TableHead>
              <TableHead className="text-right">SLG</TableHead>
              <TableHead className="text-right">OPS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStats.map((stat) => (
              <TableRow key={stat.id}>
                <TableCell className="font-medium">{stat.team_name}</TableCell>
                <TableCell className="text-right">{stat.games_played}</TableCell>
                <TableCell className="text-right">{stat.home_runs}</TableCell>
                <TableCell className="text-right">{stat.avg?.toFixed(3)}</TableCell>
                <TableCell className="text-right">{stat.obp?.toFixed(3)}</TableCell>
                <TableCell className="text-right">{stat.slg?.toFixed(3)}</TableCell>
                <TableCell className="text-right">{stat.ops?.toFixed(3)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
