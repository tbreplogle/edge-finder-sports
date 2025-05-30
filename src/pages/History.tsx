// src/pages/History.tsx
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";
import { supabase } from "@/utils/supabaseClient";

interface ResultRow {
  matchup_id: string;
  game_date: string;
  chosen_team_id: number;
  confidence: number;
  moneyline: number;
  stake: number;
  profit: number;
  outcome: "win" | "loss";
}

export default function HistoryPage() {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("mlb_daily_results")           // no generic args
        .select("*")
        .order("game_date", { ascending: false });

      if (error) {
        console.error(error);
      } else {
        setRows(data as ResultRow[]);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <AppLayout isAuthenticated>
        <div className="py-12 text-center">Loading betting history…</div>
      </AppLayout>
    );
  }

  const totalProfit = rows.reduce((sum, r) => sum + r.profit, 0);
  const totalBets   = rows.length;
  const wins        = rows.filter((r) => r.outcome === "win").length;
  const losses      = totalBets - wins;
  const totalStaked = rows.reduce((sum, r) => sum + r.stake, 0);
  const roi         = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;

  return (
    <AppLayout isAuthenticated>
      <div className="container py-8">
        <h1 className="text-2xl font-bold mb-4">Betting History</h1>

        {/* use default Alert (no variant="info") */}
        <Alert className="mb-6">
          <AlertTitle>Summary (confidence ≥ 7.0)</AlertTitle>
          <p>
            Bets: {totalBets} | Wins: {wins} | Losses: {losses} | P/L: $
            {totalProfit.toFixed(2)} | ROI: {roi.toFixed(2)}%
          </p>
        </Alert>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Matchup</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>ML</TableHead>
              <TableHead>Stake</TableHead>
              <TableHead>Profit</TableHead>
              <TableHead>Outcome</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.game_date}-${r.matchup_id}`}>
                <TableCell>
                  {format(new Date(r.game_date), "MMM d, yyyy")}
                </TableCell>
                <TableCell>{r.matchup_id}</TableCell>
                <TableCell>{r.confidence.toFixed(1)}</TableCell>
                <TableCell>
                  {r.moneyline > 0 ? `+${r.moneyline}` : r.moneyline}
                </TableCell>
                <TableCell>${r.stake}</TableCell>
                <TableCell
                  className={
                    r.profit >= 0 ? "text-green-500" : "text-red-500"
                  }
                >
                  {r.profit >= 0
                    ? `+$${r.profit.toFixed(2)}`
                    : `-$${Math.abs(r.profit).toFixed(2)}`}
                </TableCell>
                <TableCell>{r.outcome}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
