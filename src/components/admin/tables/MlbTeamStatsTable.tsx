
import { TeamStats } from "@/lib/formulas/mlbPredict";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MlbTeamStatsTableProps {
  teamStats: Record<string, TeamStats>;
}

export function MlbTeamStatsTable({ teamStats }: MlbTeamStatsTableProps) {
  if (!teamStats || Object.keys(teamStats).length === 0) {
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
          {Object.values(teamStats).map((team: TeamStats) => (
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
}
