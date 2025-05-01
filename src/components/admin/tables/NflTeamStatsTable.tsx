
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface NflTeamStats {
  team: string;
  pointsFor: number;
  pointsAgainst: number;
  ydsPerGame: number;
}

interface NflTeamStatsTableProps {
  teamStats: Record<string, NflTeamStats>;
}

export function NflTeamStatsTable({ teamStats }: NflTeamStatsTableProps) {
  if (!teamStats || Object.keys(teamStats).length === 0) {
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
          {Object.values(teamStats).map((team: NflTeamStats) => (
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
}
