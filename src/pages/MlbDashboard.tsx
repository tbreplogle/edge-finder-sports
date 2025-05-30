// src/pages/MlbDashboard.tsx
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Calendar, RefreshCw, Info, Trophy, Lock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { GameCard } from "@/components/GameCard";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { PremiumBanner } from "@/components/PremiumBanner";
import { usePageAccess } from "@/lib/usePageAccess";
import {
  fetchMlbPredictions,
  ProcessedMlbPrediction,
} from "@/utils/fetchMlbPredictions";

export default function MlbDashboard() {
  const { toast } = useToast();
  const access = usePageAccess("mlb_dashboard");
  if (access === "none") return null;
  const isLocked = access !== "full";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatedDate, setGeneratedDate] = useState<string>("");
  const [predictions, setPredictions] = useState<ProcessedMlbPrediction[]>([]);
  const [featured, setFeatured] = useState<ProcessedMlbPrediction | null>(null);
  const [preview, setPreview] = useState<ProcessedMlbPrediction | null>(null);
  const [sortBy, setSortBy] = useState<
    "edgeDesc" | "edgeAsc" | "time" | "confidence"
    >("edgeDesc");
  const load = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await fetchMlbPredictions();
      console.log("🔮 MLB predictions payload:", data);
      setGeneratedDate(format(new Date(), "MMM d, yyyy"));

      if (data.length > 0) {
        // pick largest-edge game
        const top = [...data].sort((a, b) => {
          const ae = Math.max(
            Math.abs(a.home_edge_pct ?? 0),
            Math.abs(a.away_edge_pct ?? 0)
          );
          const be = Math.max(
            Math.abs(b.home_edge_pct ?? 0),
            Math.abs(b.away_edge_pct ?? 0)
          );
          return be - ae;
        })[0];
        setFeatured(top);

        // pick next-earliest
        const others = data.filter((g) => g.matchup_id !== top.matchup_id);
        const next = others.sort(
          (a, b) =>
            new Date(a.game_time_ct).getTime() -
            new Date(b.game_time_ct).getTime()
        )[0];
        setPreview(next ?? null);

        setPredictions(data);
      } else {
        setPredictions([]);
      }
    } catch (err: any) {
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => load(true);

  return (
    <AppLayout isAuthenticated>
      <div className="container py-8">
        {/* Header */}
                {!loading && access === "full" && (
              <div className="flex justify-end mb-4">
              <select
              className="p-1 border rounded bg-card text-sm"
                value={sortBy}
                onChange={(e) =>
                    setSortBy(e.target.value as
                    | "edgeDesc"
                    | "edgeAsc"
                    | "time"
                    | "confidence")
            }
            >
              <option value="edgeDesc">Highest Edge</option>
              <option value="edgeAsc">Lowest Edge</option>
              <option value="time">Game Time</option>
              <option value="confidence">Highest Confidence</option>
            </select>
          </div>
        )}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              MLB Predictions{" "}
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
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {generatedDate}
            </Button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <RefreshCw className="h-10 w-10 animate-spin mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading MLB predictions…</p>
          </div>
        )}

        {/* Featured */}
        {!loading && featured && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-5 w-5 text-edge-secondary" />
              <h2 className="text-xl font-bold">Game of the Day</h2>
            </div>
            <GameCard
              {...featured}
              isAdmin={access === "full"}
              isFeatured
              sport="mlb"
            />
          </section>
        )}

        {/* Preview */}
        {!loading && preview && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-5 w-5" />
              <h2 className="text-xl font-bold">Free Preview Game</h2>
            </div>
            <GameCard
              {...preview}
              isAdmin={access === "full"}
              isPreviewGame
              sport="mlb"
            />
          </section>
        )}

        {/* Locked */}
        {!loading && isLocked && <PremiumBanner />}

        {/* Info Alert */}
        {!loading && (
          <Alert className="mb-6 bg-muted">
            <Info className="h-4 w-4" />
            <AlertTitle>MLB Predictions</AlertTitle>
            <AlertDescription>
              Using live data from the <code>mlb_predictions</code> table and
              current market odds.
            </AlertDescription>
          </Alert>
        )}

        {/* All vs Locked */}
        {!loading &&
          (access === "full" ? (
            <div>
              <h2 className="text-xl font-bold mb-4">All MLB Games</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {predictions.map((p) => (
                  <GameCard key={p.matchup_id} {...p} isAdmin sport="mlb" />
                ))}
              </div>
            </div>
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
              <Button onClick={() => (window.location.href = "/pricing")}>
                Upgrade Now
              </Button>
            </div>
          ))}

        {/* Legend */}
        {!loading && (
          <div className="mt-8 p-4 border rounded-lg bg-card">
            <h3 className="font-medium mb-2">Legend</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-edge-mlb rounded-full" />
                <span className="font-medium">MLB</span>
              </div>
              <div>
                <p>
                  <strong>Predicted Odds:</strong>{" "}
                  from <code>mlb_predictions.moneyline</code>
                </p>
                <p>
                  <strong>Market / Predicted %:</strong> implied probability
                </p>
                <p>
                  <strong>Edge %:</strong> predicted − market %
                </p>
              </div>
              <div>
                <p>Last updated: {generatedDate}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
