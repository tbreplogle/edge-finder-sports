
import { PitcherStats } from "@/lib/formulas/mlbPredict";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MlbPitchersTableProps {
  pitchers: Record<string, PitcherStats>;
}

export function MlbPitchersTable({ pitchers }: MlbPitchersTableProps) {
  if (!pitchers || Object.keys(pitchers).length === 0) {
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
          {Object.values(pitchers).map((pitcher: PitcherStats) => (
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
}
