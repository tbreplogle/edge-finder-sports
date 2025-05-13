import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Calendar, RefreshCw, Info, Trophy, Lock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { MlbPredictionsTable } from "@/components/admin/MlbPredictionsTable";
import {
  fetchMlbPredictions,
  ProcessedMlbPrediction,
} from "@/utils/fetchMlbPredictions";
import { findHighestEdgePrediction } from "@/lib/utils";
import { GameCard } from "@/components/GameCard";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { PremiumBanner } from "@/components/PremiumBanner";

// -------------------------------------------------------------
// Types
// -------------------------------------------------------------
interface MlbPredictionDisplay {
  matchup_id: string;
  game_id: string;
  home_team: string;
  away_team: string;
  game_date: string;
  game_time_ct: string;
  home_market_ml: number | null;
  away_market_ml: number | null;
  home_market_pct: number | null;
  away_market_pct: number | null;
  home_pred_pct: number | null;
  away_pred_pct: number | null;
  home_pred_ml: number | null;
  away_pred_ml: number | null;
  home_edge_pct: number | null;
  away_edge_pct: number | null;
  home_pitcher: string | null;
  away_pitcher: string | null;
  updated_at: string;
}

const MlbDashboard = () => {
  // -----------------------------------------------------------
  // State
  // -----------------------------------------------------------
  const { toast } = useToast();
  const [predictions, setPredictions] =
    useState<MlbPredictionDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated] = useState(true); // ← replace when real auth ready
  const [generatedDate, setGeneratedDate] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [featuredGame, setFeaturedGame] =
    useState<ProcessedMlbPrediction | null>(null);
  const [previewGame, setPreviewGame] =
    useState<ProcessedMlbPrediction | null>(null);

  const [isPaid, setIsPaid] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // -----------------------------------------------------------
  // Read user status from localStorage (simple stub)
  // -----------------------------------------------------------
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) return;

    try {
      const u = JSON.parse(stored);
      setIsAdmin(u.is_admin === true);
      setIsPaid(u.role === "premium" || u.is_admin === true);
    } catch (err) {
      console.error("Error parsing user data:", err);
    }
  }, []);

  // -----------------------------------------------------------
  // Data fetcher
  // -----------------------------------------------------------
  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const mlbPredictions = await fetchMlbPredictions();

      if (mlbPredictions.length === 0) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // 1. Game with the biggest edge
      const featured = findHighestEdgePrediction(mlbPredictions);

      // 2. Earliest game by start time
      const sorted = [...mlbPredictions].sort(
        (a, b) =>
          new Date(a.game_time_ct).getTime() -
          new Date(b.game_time_ct).getTime(),
      );

      // 3. Set featured / preview
      setFeaturedGame(featured ?? null);

      if (sorted.length > 0) {
        if (featured && sorted[0].matchup_id === featured.matchup_id) {
          setPreviewGame(sorted[1] ?? null);
        } else {
          setPreviewGame(sorted[0]);
        }
      } else {
        setPreviewGame(null);
      }

      // 4. Regular list (exclude featured + preview)
      const regular = mlbPredictions.filter(
        (p) =>
          !(featured && p.matchup_id === featured.matchup_id) &&
          !(previewGame && p.matchup_id === previewGame.matchup_id),
      );

      const formatted: MlbPredictionDisplay[] = regular.map((p) => ({
        ...p,
        game_date: new Date(p.game_time_ct)
          .toISOString()
          .split("T")[0],
        updated_at: new Date().toISOString(),
      }));

      setPredictions(formatted);
      setGeneratedDate(format(new Date(), "MMM d, yyyy"));
    } catch (err) {
      console.error("Error fetching MLB predictions:", err);
      toast({
        title: "Error",
        description: "Failed to load MLB predictions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // initial load
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => fetchData(true);

  const todayFormatted = format(new Date(), "MMM d, yyyy");

  // -----------------------------------------------------------
  // Render
  // -----------------------------------------------------------
  return (
    <AppLayout isAuthenticated={isAuthenticated}>
      <div className="container py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              MLB Predictions
              <span className="text-edge-secondary">Dashboard</span>
            </h1>
            <p className="text-muted-foreground">
              MLB games with predicted odds and market edges
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
            </Button>

            <Button
              variant="outline"
              className="flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              <span>{generatedDate || todayFormatted}</span>
            </Button>
          </div>
        </div>

        {/* ------------------------ Featured game ------------------------ */}
        {featuredGame && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-5 w-5 text-edge-secondary" />
              <h2 className="text-xl font-bold">Game of the Day</h2>
            </div>
            <div className="max-w-5xl mx-auto">
              <GameCard
                {...featuredGame}
                isAdmin={isAdmin}
                isFeatured
                isPremium={!isPaid && !isAdmin}
              />
            </div>
          </section>
        )}

        {/* ------------------------ Preview game ------------------------ */}
        {previewGame && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-5 w-5" />
              <h2 className="text-xl font-bold">Free Preview Game</h2>
            </div>
            <div className="max-w-5xl mx-auto">
              <GameCard
                {...previewGame}
                isAdmin={isAdmin}
                isFeatured={false}
                isPremium={false}
              />
            </div>
          </section>
        )}

        {/* Premium upsell */}
        {!isPaid && !isAdmin && <PremiumBanner />}

        {/* Alert */}
        <Alert className="mb-6 bg-muted">
          <Info className="h-4 w-4" />
          <AlertTitle>MLB Predictions</AlertTitle>
          <AlertDescription>
            Using live data from the <code>mlb_predictions</code>{" "}
            table and current market odds.
          </AlertDescription>
        </Alert>

        {/* Main table */}
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="h-10 w-10 animate-spin mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Loading MLB predictions…
            </p>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-bold mb-4">All MLB Games</h2>

            {isPaid || isAdmin ? (
              <MlbPredictionsTable
                predictions={predictions}
                isLoading={false}
              />
            ) : (
              <div className="bg-card border rounded-lg p-8 text-center">
                <Lock className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-medium mb-2">
                  Premium Content Locked
                </h3>
                <p className="text-muted-foreground mb-4">
                  Upgrade to a premium account to see all MLB
                  predictions and detailed analytics.
                </p>
                <Button
                  onClick={() => (window.location.href = "/pricing")}
                >
                  Upgrade Now
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="mt-8 p-4 border rounded-lg bg-card">
          <h3 className="font-medium mb-2">Legend</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 bg-edge-mlb rounded-full" />
                <span className="text-sm font-medium">MLB</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              <p>
                <strong>Predicted Odds:</strong>{" "}
                from <code>mlb_predictions.moneyline</code>
              </p>
              <p>
                <strong>Market / Predicted Implied %:</strong>{" "}
                conversion from odds to win probability
              </p>
              <p>
                <strong>Edge %:</strong>{" "}
                difference between predicted and market implied
                percentages
              </p>
            </div>

            <div className="text-xs text-muted-foreground">
              <p>Last updated: {generatedDate || todayFormatted}</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default MlbDashboard;
