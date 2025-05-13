import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Calendar, RefreshCw, Trophy, Info, Lock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { fetchMlbPredictions, ProcessedMlbPrediction } from "@/utils/fetchMlbPredictions";
import { GameCard } from "@/components/GameCard";
import { PremiumBanner } from "@/components/PremiumBanner";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { MlbPredictionsTable } from "@/components/admin/MlbPredictionsTable";

type SortKey = "time" | "edge_desc" | "edge_asc";

export default function MlbDashboard() {
  const { toast } = useToast();

  const [predictions, setPredictions] = useState<ProcessedMlbPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  /* -------- user status -------- */
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) return;
    try {
      const u = JSON.parse(raw);
      setIsAdmin(u.is_admin === true);
      setIsPaid(u.role === "premium" || u.is_admin === true);
    } catch {}
  }, []);

  /* -------- fetch helper -------- */
  const pull = async () => {
    try {
      const list = await fetchMlbPredictions();
      setPredictions(list);
    } catch (err) {
      console.error(err);
      toast({
        title: "Fetch error",
        description: "Could not load MLB predictions.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    pull();
  }, []);

  /* -------- sorting -------- */
  const [sortKey, setSortKey] = useState<SortKey>("time");
  const sorted = [...predictions].sort((a, b) => {
    switch (sortKey) {
      case "edge_desc":
        return Math.abs(b.home_edge_pct ?? 0) - Math.abs(a.home_edge_pct ?? 0);
      case "edge_asc":
        return Math.abs(a.home_edge_pct ?? 0) - Math.abs(b.home_edge_pct ?? 0);
      default:
        return (
          new Date(a.game_time_ct).getTime() - new Date(b.game_time_ct).getTime()
        );
    }
  });

  /* -------- featured + preview -------- */
  const featured = sorted.reduce<ProcessedMlbPrediction | null>((acc, g) => {
    const edge = Math.max(
      Math.abs(g.home_edge_pct ?? 0),
      Math.abs(g.away_edge_pct ?? 0)
    );
    if (!acc) return g;
    const accEdge = Math.max(
      Math.abs(acc.home_edge_pct ?? 0),
      Math.abs(acc.away_edge_pct ?? 0)
    );
    return edge > accEdge ? g : acc;
  }, null);

  const earliest = sorted.find(
    (g) => g.matchup_id !== featured?.matchup_id
  ) ?? null;

  /* remove featured / preview from list */
  const rest = sorted.filter(
    (g) =>
      g.matchup_id !== featured?.matchup_id &&
      g.matchup_id !== earliest?.matchup_id
  );

  /* -------- ui helpers -------- */
  const todayStr = format(new Date(), "MMM d, yyyy");

  return (
    <AppLayout>
      <div className="container py-8 space-y-10">
        {/* header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">MLB Predictions</h1>
            <p className="text-muted-foreground">Edges vs. market money‑lines</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRefreshing(true);
                pull();
              }}
              disabled={refreshing}
            >
              <RefreshCw
                className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`}
              />
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>

            <select
              className="rounded-md border bg-card text-sm px-3 py-2"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="time">Game Time</option>
              <option value="edge_desc">Highest Edge</option>
              <option value="edge_asc">Lowest Edge</option>
            </select>

            <Button variant="outline">
              <Calendar className="w-4 h-4 mr-1" />
              {todayStr}
            </Button>
          </div>
        </div>

        {/* -------- Featured game -------- */}
        {featured && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-edge-secondary" />
              <h2 className="text-xl font-bold">Game of the Day</h2>
            </div>

            <GameCard
              {...featured}
              sport="mlb"
              variant="featured"
              isAdmin={isAdmin}
              isPaid={isPaid}
              isPremium={!isPaid && !isAdmin}
            />
          </section>
        )}

        {/* -------- Preview game (always free) -------- */}
        {earliest && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              <h2 className="text-xl font-bold">Free Preview Game</h2>
            </div>

            <GameCard
              {...earliest}
              sport="mlb"
              isPreviewGame
              variant="regular"
              isAdmin={isAdmin}
              isPaid={isPaid}
              isPremium={false}
            />
          </section>
        )}

        {/* premium upsell */}
        {!isPaid && !isAdmin && <PremiumBanner />}

        {/* rest of table / locked */}
        <Alert className="bg-muted mb-6">
          <Info className="w-4 h-4" />
          <AlertTitle>Info</AlertTitle>
          <AlertDescription>
            Predictions pulled live from <code>mlb_predictions</code>.
          </AlertDescription>
        </Alert>

        {loading ? (
          <div className="text-center py-16">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground mb-4" />
            Loading…
          </div>
        ) : isPaid || isAdmin ? (
          <MlbPredictionsTable predictions={rest} isLoading={false} />
        ) : (
          <div className="bg-card border rounded-lg p-8 text-center">
            <Lock className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium mb-2">Premium Content Locked</h3>
            <p className="text-muted-foreground mb-4">
              Upgrade to view all remaining games & analytics.
            </p>
            <Button onClick={() => (window.location.href = "/pricing")}>
              Upgrade Now
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
