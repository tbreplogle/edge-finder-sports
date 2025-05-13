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

// -----------------------------------------------------------------------------
// Table‑view interface (unchanged)
// -----------------------------------------------------------------------------
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
  const { toast } = useToast();

  // ---------------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------------
  const [predictions, setPredictions] =
    useState<MlbPredictionDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatedDate, setGeneratedDate] = useState<string | null>(null);

  const [featuredGame, setFeaturedGame] =
    useState<ProcessedMlbPrediction | null>(null);
  const [previewGame, setPreviewGame] =
    useState<ProcessedMlbPrediction | null>(null);

  const [isPaid, setIsPaid] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // ---------------------------------------------------------------------------
  // Auth stub – reads localStorage (replace with real auth)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) return;
    try {
      const user = JSON.parse(stored);
      setIsAdmin(user.is_admin === true);
      setIsPaid(user.role === "premium" || user.is_admin === true);
    } catch (err) {
      console.error("Error parsing user data:", err);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Data fetcher
  // ---------------------------------------------------------------------------
  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const mlbPredictions = await fetchMlbPredictions();

      // 1. Game with highest absolute edge → featured
      const featured = findHighestEdgePrediction(mlbPredictions) ?? null;

      // 2. Earliest game that isn’t the featured → preview
      const sorted = [...mlbPredictions].sort(
        (a, b) =>
          new Date(a.game_time_ct).getTime() -
          new Date(b.game_time_ct).getTime(),
      );
      const firstNonFeatured = sorted.find(
        (g) => !featured || g.matchup_id !== featured.matchup_id,
      );
      setFeaturedGame(featured);
      setPreviewGame(firstNonFeatured ?? null);

      // 3. Regular table (exclude featured + preview)
      const tableRows = mlbPredictions.filter(
        (p) =>
          (!featured || p.matchup_id !== featured.matchup_id) &&
          (!firstNonFeatured ||
            p.matchup_id !== firstNonFeatured.matchup_id),
      );

      const formatted: MlbPredictionDisplay[] = tableRows.map((p) => ({
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <AppLayout isAuthenticated={true /* layout still expects this */}>
      <div className="container py-8">
        {/* ---------- header ---------- */}
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

        {/* ---------- featured game ---------- */}
        {featuredGame && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-5 w-5 text-edge-secondary" />
              <h2 className="text-xl font-bold">Game of the Day</h2>
            </div>

            <div className="max-w-5xl mx-auto">
              <GameCard
                /* generic props */
                id={featuredGame.matchup_id}
                sport="mlb"
                homeTeam={featuredGame.home_team}
                awayTeam={featuredGame.away_team}
                startTime={featuredGame.game_time_ct}
                /* role / variant */
                isAdmin={isAdmin}
                isPremium={false}          // always free to view
                variant="featured"
                /* odds + percentages */
                homeMarketMoneyline={featuredGame.home_market_ml}
                awayMarketMoneyline={featuredGame.away_market_ml}
                homePredictedOdds={featuredGame.home_pred_ml}
                awayPredictedOdds={featuredGame.away_pred_ml}
                homePredictedPct={featuredGame.home_pred_pct}
                awayPredictedPct={featuredGame.away_pred_pct}
                /* edge for arrow colouring */
                edgePct={
                  Math.max(
                    featuredGame.home_edge_pct ?? 0,
                    featuredGame.away_edge_pct ?? 0,
                  ) || null
                }
              />
            </div>
          </section>
        )}

        {/* ---------- preview game (free teaser) ---------- */}
        {previewGame && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-5 w-5" />
              <h2 className="text-xl font-bold">Free Preview Game</h2>
            </div>

            <div className="max-w-5xl mx-auto">
              <GameCard
                id={previewGame.matchup_id}
                sport="mlb"
                homeTeam={previewGame.home_team}
                awayTeam={previewGame.away_team}
                startTime={previewGame.game_time_ct}
                isAdmin={isAdmin}
                isPremium={false}
                isPreviewGame
                variant="regular"
                homeMarketMoneyline={previewGame.home_market_ml}
                awayMarketMoneyline={previewGame.away_market_ml}
                homePredictedOdds={previewGame.home_pred_ml}
                awayPredictedOdds={previewGame.away_pred_ml}
                homePredictedPct={previewGame.home_pred_pct}
                awayPredictedPct={previewGame.away_pred_pct}
              />
            </div>
          </section>
        )}

        {/* upsell banner */}
        {!isPaid && !isAdmin && <PremiumBanner />}

        {/* info alert */}
        <Alert className="mb-6 bg-muted">
          <Info className="h-4 w-4" />
          <AlertTitle>MLB Predictions</AlertTitle>
          <AlertDescription>
            Using live data from the <code>mlb_predictions</code> table and
            current market odds.
          </AlertDescription>
        </Alert>

        {/* main table */}
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="h-10 w-10 animate-spin mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading MLB predictions…</p>
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
                  Upgrade to a premium account to see all MLB predictions and
                  detailed analytics.
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

        {/* legend */}
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
                <strong>Predicted Odds:</strong> from{" "}
                <code>mlb_predictions.moneyline</code>
              </p>
              <p>
                <strong>Market / Predicted Implied %:</strong> win‑probability
                conversion
              </p>
              <p>
                <strong>Edge %:</strong> difference between predicted and market
                implied percentages
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
