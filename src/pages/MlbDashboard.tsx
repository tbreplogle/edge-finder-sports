/* -------------------------------------------------------------------------- */
/*  src/pages/MlbDashboard.tsx                                                */
/* -------------------------------------------------------------------------- */
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Calendar,
  Info,
  RefreshCw,
  Trophy,
  Lock,
} from "lucide-react";
import { fetchMlbPredictions } from "@/utils/fetchMlbPredictions";
import { AppLayout } from "@/components/AppLayout";
import { Button }   from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { GameCard } from "@/components/GameCard";
import { PremiumBanner } from "@/components/PremiumBanner";
import { useToast } from "@/components/ui/use-toast";

import {
  fetchMlbPredictions,
  ProcessedMlbPrediction,
} from "@/utils/fetchMlbPredictions";
import { usePageAccess } from "@/lib/usePageAccess";

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */
const absEdge = (g: ProcessedMlbPrediction) =>
  Math.max(Math.abs(g.home_edge_pct ?? 0), Math.abs(g.away_edge_pct ?? 0));

const mlToPct = (ml: number | null) =>
  ml == null
    ? null
    : ml > 0
    ? 100 / (ml + 100)
    : Math.abs(ml) / (Math.abs(ml) + 100);

/* ------------------------------------------------------------------ */
/* component                                                          */
/* ------------------------------------------------------------------ */
export default function MlbDashboard() {
  const { toast } = useToast();

  /* ──────────────────────────────────────────────────────────────────
     access-control (guest / premium / admin)                       */
  const access = usePageAccess("mlb");
  if (access === "none") return null;
  const isLocked = access !== "full";

  /* ──────────────────────────────────────────────────────────────────
     local state                                                     */
  const [raw, setRaw]           = useState<ProcessedMlbPrediction[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRef]    = useState(false);
  const [generated, setGen]     = useState<string | null>(null);
  const [sortKey, setSortKey]   = useState<"time" | "edge">("time");

  /* auth stub – you already had this; kept for GameCard props */
  const [isAdmin, setIsAdmin]   = useState(false);
  useEffect(() => {
    try {
      const json = localStorage.getItem("user");
      if (json) setIsAdmin(JSON.parse(json).is_admin === true);
    } catch {/* ignore */}
  }, []);

  /* ──────────────────────────────────────────────────────────────────
     fetcher                                                          */
  const load = async (isRefresh = false) => {
    isRefresh ? setRef(true) : setLoading(true);
    try {
      const data = await fetchMlbPredictions();

      /* fill in market pct if the view didn’t provide them */
      const complete = data.map((g) => ({
        ...g,
        home_market_pct: g.home_market_pct ?? mlToPct(g.home_market_ml),
        away_market_pct: g.away_market_pct ?? mlToPct(g.away_market_ml),
      }));

      setRaw(complete);
      setGen(format(new Date(), "MMM d, yyyy"));
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to load MLB predictions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRef(false);
    }
  };
  useEffect(() => { load(); }, []);                 /* initial */

  /* manual refresh */
  const doRefresh = () => load(true);

  /* ──────────────────────────────────────────────────────────────────
     derived selections                                               */
  const sorted = useMemo(() => {
    const copy = [...raw];
    if (sortKey === "edge") copy.sort((a, b) => absEdge(b) - absEdge(a));
    else copy.sort((a, b) =>
        new Date(a.game_time_ct).getTime() - new Date(b.game_time_ct).getTime()
    );
    return copy;
  }, [raw, sortKey]);

  const featured = useMemo(() => sorted[0] ?? null, [sorted]);
  const preview  = useMemo(() => sorted[1] ?? null, [sorted]);

  /* grid sans featured/preview */
  const gridRows = sorted.slice(isLocked ? 0 : 2);

  const today = format(new Date(), "MMM d, yyyy");

  /* ------------------------------------------------------------------ */
  /* render                                                             */
  /* ------------------------------------------------------------------ */
  return (
    <AppLayout isAuthenticated>
      <div className="container py-8">
        {/* header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              MLB Predictions <span className="text-edge-secondary">Dashboard</span>
            </h1>
            <p className="text-muted-foreground">
              Moneyline probabilities & market edges for today&apos;s games
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={doRefresh}
              disabled={refreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>

            <Button variant="outline" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {generated ?? today}
            </Button>
          </div>
        </div>

        {/* feature / preview */}
        {!loading && featured && (
          <>
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="h-5 w-5 text-edge-secondary" />
                <h2 className="text-xl font-bold">Game of the Day</h2>
              </div>

              <div className="max-w-5xl mx-auto">
                <GameCard {...featured} isAdmin={isAdmin} isFeatured sport="mlb" />
              </div>
            </section>

            {preview && (
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="h-5 w-5" />
                  <h2 className="text-xl font-bold">Free Preview Game</h2>
                </div>

                <div className="max-w-5xl mx-auto">
                  <GameCard
                    {...preview}
                    isAdmin={isAdmin}
                    isPreviewGame
                    sport="mlb"
                  />
                </div>
              </section>
            )}
          </>
        )}

        {/* upsell for guests */}
        {isLocked && <PremiumBanner />}

        {/* info */}
        <Alert className="mb-6 bg-muted">
          <Info className="h-4 w-4" />
          <AlertTitle>MLB Predictions</AlertTitle>
          <AlertDescription>
            Data from&nbsp;<code>mlb_predictions_with_market()</code>&nbsp;view.
          </AlertDescription>
        </Alert>

        {/* main grid */}
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="h-10 w-10 animate-spin mx-auto text-muted-foreground mb-4" />
            Loading MLB predictions…
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">MLB Games</h2>
              <select
                value={sortKey}
                onChange={(e) =>
                  setSortKey(e.target.value as "time" | "edge")
                }
                className="text-sm rounded border bg-card px-2 py-1"
              >
                <option value="time">Game Time</option>
                <option value="edge">Highest Edge</option>
              </select>
            </div>

            {gridRows.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No MLB games scheduled today
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {gridRows.map((g) => (
                  <GameCard key={g.matchup_id} {...g} isAdmin={isAdmin} sport="mlb" />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
