
import { Matchup } from "@/lib/formulas/mlbPredict";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MlbMatchupsTableProps {
  matchups: Matchup[];
}

export function MlbMatchupsTable({ matchups }: MlbMatchupsTableProps) {
  if (!matchups || matchups.length === 0) {
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
          {matchups.map((matchup: Matchup) => (
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
}
