
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface NflMatchup {
  game_id: string;
  away: string;
  home: string;
}

interface NflMatchupsTableProps {
  matchups: NflMatchup[];
}

export function NflMatchupsTable({ matchups }: NflMatchupsTableProps) {
  if (!matchups || matchups.length === 0) {
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
          {matchups.map((matchup: NflMatchup) => (
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
}
