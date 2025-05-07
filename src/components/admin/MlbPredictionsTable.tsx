
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";

// Define a custom type for our MLB prediction display
interface MlbPredictionDisplay {
  matchup_id: string;
  game_id?: string;
  home_team: string;
  away_team: string;
  game_date: string;
  moneyline?: number;             // Predicted Odds
  market_ml?: number;             // Actual Market Odds
  market_implied_pct?: number;    // Market Implied %
  predicted_implied_pct?: number; // Predicted Implied %
  edge_pct?: number;              // Edge %
  updated_at: string;
}

interface MlbPredictionsTableProps {
  predictions: MlbPredictionDisplay[];
  isLoading: boolean;
}

export function MlbPredictionsTable({ predictions, isLoading }: MlbPredictionsTableProps) {
  // Function to format moneyline odds with + sign
  const formatMoneyline = (ml?: number | null) => {
    if (ml === undefined || ml === null) return "—";
    return ml > 0 ? `+${ml}` : `${ml}`;
  };

  // Function to format percentages with 2 decimal places
  const formatPercentage = (value?: number | null) => {
    if (value === undefined || value === null) return "—";
    return `${(value * 100).toFixed(2)}%`;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">ID</TableHead>
            <TableHead>Matchup</TableHead>
            <TableHead className="w-32 text-right">Predicted Odds</TableHead>
            <TableHead className="w-32 text-right">Actual Market Odds</TableHead>
            <TableHead className="w-32 text-right">Market Implied %</TableHead>
            <TableHead className="w-32 text-right">Predicted Implied %</TableHead>
            <TableHead className="w-32 text-right">Edge %</TableHead>
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
                No MLB predictions found
              </TableCell>
            </TableRow>
          ) : (
            predictions.map((prediction) => (
              <TableRow key={`${prediction.matchup_id}`}>
                <TableCell className="font-mono text-xs">{prediction.matchup_id}</TableCell>
                <TableCell>
                  <div className="font-medium">{prediction.away_team} @ {prediction.home_team}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{prediction.game_id || '-'}</div>
                </TableCell>
                <TableCell className="text-right">
                  {formatMoneyline(prediction.moneyline)}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoneyline(prediction.market_ml)}
                </TableCell>
                <TableCell className="text-right">
                  {formatPercentage(prediction.market_implied_pct)}
                </TableCell>
                <TableCell className="text-right">
                  {formatPercentage(prediction.predicted_implied_pct)}
                </TableCell>
                <TableCell className="text-right">
                  {prediction.edge_pct !== undefined ? (
                    <span className={Number(prediction.edge_pct) > 0 ? "text-green-600" : "text-red-600"}>
                      {formatPercentage(prediction.edge_pct)}
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
