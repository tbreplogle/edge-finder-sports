
import { Tables } from "@/integrations/supabase/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";

interface PredictionsTableProps {
  predictions: Tables<"predictions">[];
  isLoading: boolean;
}

export function PredictionsTable({ predictions, isLoading }: PredictionsTableProps) {
  // Function to format moneyline odds with + sign
  const formatMoneyline = (ml?: number | null) => {
    if (ml === undefined || ml === null) return "—";
    return ml > 0 ? `+${ml}` : `${ml}`;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">ID</TableHead>
            <TableHead className="w-20">Sport</TableHead>
            <TableHead>Game</TableHead>
            <TableHead className="w-32 text-right">Predicted Margin</TableHead>
            <TableHead className="w-24 text-right">Home ML</TableHead>
            <TableHead className="w-24 text-right">Away ML</TableHead>
            <TableHead className="w-24 text-right">Edge</TableHead>
            <TableHead className="w-32">Game Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center h-24">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </TableCell>
            </TableRow>
          ) : predictions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                No predictions found
              </TableCell>
            </TableRow>
          ) : (
            predictions.map((prediction) => (
              <TableRow key={prediction.id}>
                <TableCell className="font-mono text-xs">{prediction.id}</TableCell>
                <TableCell>
                  <Badge variant="outline">{prediction.sport}</Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{prediction.away_team} @ {prediction.home_team}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{prediction.game_id}</div>
                </TableCell>
                <TableCell className="text-right">
                  {prediction.predicted_margin ? (
                    prediction.predicted_margin > 0 ? (
                      <span className="text-green-600">+{Number(prediction.predicted_margin).toFixed(1)}</span>
                    ) : (
                      <span className="text-red-600">{Number(prediction.predicted_margin).toFixed(1)}</span>
                    )
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoneyline(prediction.home_ml)}
                  {prediction.market_home_ml ? (
                    <div className="text-xs text-muted-foreground">
                      ({formatMoneyline(prediction.market_home_ml)})
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoneyline(prediction.away_ml)}
                  {prediction.market_away_ml ? (
                    <div className="text-xs text-muted-foreground">
                      ({formatMoneyline(prediction.market_away_ml)})
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-right">
                  {prediction.edge !== null ? (
                    <span className={Number(prediction.edge) > 0 ? "text-green-600" : "text-red-600"}>
                      {Number(prediction.edge).toFixed(1)}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {new Date(prediction.game_date).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
