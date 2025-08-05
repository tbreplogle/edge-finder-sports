import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { fetchMlbPredictions } from "@/utils/fetchMlbPredictions";

const Members = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    // Check user role from localStorage
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      navigate("/auth/login");
      return;
    }
    const userData = JSON.parse(userStr);
    const paid =
      userData.role === "premium" ||
      userData.role === "enterprise" ||
      userData.is_admin === true;
    setIsAllowed(paid);
    if (!paid) {
      navigate("/pricing");
    }
  }, [navigate]);

  useEffect(() => {
    if (!isAllowed) return;
    const getData = async () => {
      try {
        setLoading(true);
        const data = await fetchMlbPredictions();
        setPredictions(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    getData();
  }, [isAllowed]);

  if (!isAllowed) return null;

  return (
    <AppLayout isAuthenticated={true}>
      <div className="container py-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-4">Member Dashboard</h1>
        {loading ? (
          <p>Loading predictions...</p>
        ) : predictions.length === 0 ? (
          <p>No predictions available.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
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
