import { AppLayout } from "@/components/AppLayout";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useMlbBets } from "@/hooks/useMlbBets";
import { useNavigate } from "react-router-dom";

const Members = () => {
  const navigate = useNavigate();
  const { data: predictions = [], isLoading } = useMlbBets();

  const userStr = localStorage.getItem("user");
  if (!userStr) {
    navigate("/auth/login");
    return null;
  }
  const user = JSON.parse(userStr);
  const paid = user.is_admin || user.role === "premium" || user.role === "enterprise";
  if (!paid) {
    navigate("/pricing");
    return null;
  }

  return (
    <AppLayout isAuthenticated={true}>
      <div className="container py-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-4">Daily MLB Picks</h1>
        {isLoading ? (
          <p>Loading predictions…</p>
        ) : predictions.length === 0 ? (
          <p>No predictions for today.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time CT</TableHead>
                  <TableHead>Matchup</TableHead>
                  <TableHead>Market ML (Away)</TableHead>
                  <TableHead>Market ML (Home)</TableHead>
                  <TableHead>Our % (Away)</TableHead>
                  <TableHead>Our % (Home)</TableHead>
                  <TableHead>Edge (Away)</TableHead>
                  <TableHead>Edge (Home)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {predictions.map((pred: any) => (
                  <TableRow key={pred.matchup_id}>
                    <TableCell>{pred.game_time_ct}</TableCell>
                    <TableCell>{pred.away_team} @ {pred.home_team}</TableCell>
                    <TableCell>{pred.away_market_ml}</TableCell>
                    <TableCell>{pred.home_market_ml}</TableCell>
                    <TableCell>{pred.away_pred_pct != null ? (pred.away_pred_pct * 100).toFixed(1) + "%" : "N/A"}</TableCell>
                    <TableCell>{pred.home_pred_pct != null ? (pred.home_pred_pct * 100).toFixed(1) + "%" : "N/A"}</TableCell>
                    <TableCell>{pred.away_edge_pct != null ? (pred.away_edge_pct * 100).toFixed(1) + "%" : "N/A"}</TableCell>
                    <TableCell>{pred.home_edge_pct != null ? (pred.home_edge_pct * 100).toFixed(1) + "%" : "N/A"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Members;
