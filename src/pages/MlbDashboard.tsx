// src/pages/MlbDashboard.tsx
import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Calendar,
  Info,
  Lock,
  RefreshCw,
  Trophy,
} from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { PremiumBanner } from "@/components/PremiumBanner";
import { GameCard } from "@/components/GameCard";
import { MlbPredictionsTable } from "@/components/admin/MlbPredictionsTable";
import {
  fetchMlbPredictions,
  ProcessedMlbPrediction,
} from "@/utils/fetchMlbPredictions";
import { findHighestEdgePrediction } from "@/lib/utils";
import { usePageAccess } from "@/lib/usePageAccess";

/* ──────────────────────────────────────────────────────────── */
/* Table-view interface                                        */
/* ──────────────────────────────────────────────────────────── */
interface TableRow {
  matchup_id: string;
  game_id: string;
  home_team: string;
  away_team: string;
  game_time_ct: string;
  home_market_ml: number | null;
  away_market_ml: number | null;
  home_pred_ml: number | null;
  away_pred_ml: number | null;
  home_pred_pct: number | null;
  away_pred_pct: number | null;
  home_edge_pct: number | null;
  away_edge_pct: number | null;
  home_pitcher: string | null;
  away_pitcher: string | null;
}

/* ──────────────────────────────────────────────────────────── */
/* Component                                                   */
/* ──────────────────────────────────────────────────────────── */
const MlbDashboard = () => {
  const { toast } = useToast();
  const access = usePageAccess("mlb_dashboard");      // none | preview | full
  if (access === "none") return null;

  const isLocked = access !== "full";

  const [predRows, setPredRows] = useState<TableRow[]>([]);
  const [featured, setFeatured] = useState<ProcessedMlbPrediction | null>(null);
  const [preview,  setPreview ] = useState<ProcessedMlbPrediction | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [generatedDate,setGeneratedDate]= useState<string | null>(null);
  const [isAdmin,      setIsAdmin]      = useState(false);

  /* ── dummy auth read (replace with real) ── */
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      setIsAdmin(user.is_admin === true);
    } catch {/* ignore */}
  }, []);

  /* ──────────────────────────────────────── */
  const loadData = async (isRefresh=false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const preds = await fetchMlbPredictions();

      /* featured & preview */
      const feat = findHighestEdgePrediction(preds) ?? null;
      const sorted = [...preds].sort(
        (a,b)=>new Date(a.game_time_ct).getTime()-new Date(b.game_time_ct).getTime()
      );
      const prev = sorted.find(g=>!feat || g.matchup_id!==feat.matchup_id) ?? null;
      setFeatured(feat);
      setPreview(prev);

      /* table rows */
      const rows = preds.filter(p =>
        (!feat || p.matchup_id!==feat.matchup_id) &&
        (!prev || p.matchup_id!==prev.matchup_id)
      ).map(p=>({...p}));

      setPredRows(rows);
      setGeneratedDate(format(new Date(),"MMM d, yyyy"));
    } catch (err:any) {
      console.error(err);
      toast({
        title:"Error",
        description:"Failed to load MLB predictions. Please try again.",
        variant:"destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(()=>{ loadData(); },[]);                         // initial load
  const handleRefresh = ()=> loadData(true);
  const today = format(new Date(),"MMM d, yyyy");

  /* ──────────────────────────────────────── */
  return (
    <AppLayout isAuthenticated /* stub */>
      <div className="container py-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              MLB Predictions <span className="text-edge-secondary">Dashboard</span>
            </h1>
            <p className="text-muted-foreground">
              MLB games with predicted odds and market edges
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing?'animate-spin':''}`} />
              <span>{refreshing?'Refreshing…':'Refresh'}</span>
            </Button>
            <Button variant="outline">
              <Calendar className="h-4 w-4" />
              <span>{generatedDate || today}</span>
            </Button>
          </div>
        </div>

        {/* Featured game */}
        {featured && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-5 w-5 text-edge-secondary" />
              <h2 className="text-xl font-bold">Game of the Day</h2>
            </div>
            <div className="max-w-5xl mx-auto">
              <GameCard
                id={featured.matchup_id}
                sport="mlb"
                homeTeam={featured.home_team}
                awayTeam={featured.away_team}
                startTime={featured.game_time_ct}
                isAdmin={isAdmin}
                isPremium={false}
                variant="featured"
                homeMarketMoneyline={featured.home_market_ml}
                awayMarketMoneyline={featured.away_market_ml}
                homePredictedOdds={featured.home_pred_ml}
                awayPredictedOdds={featured.away_pred_ml}
                homePredictedPct={featured.home_pred_pct}
                awayPredictedPct={featured.away_pred_pct}
                edgePct={Math.max(
                  featured.home_edge_pct ?? 0,
                  featured.away_edge_pct ?? 0
                )}
                homePitcher={featured.home_pitcher}
                awayPitcher={featured.away_pitcher}
              />
            </div>
          </section>
        )}

        {/* Preview game */}
        {preview && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-5 w-5" />
              <h2 className="text-xl font-bold">Free Preview Game</h2>
            </div>
            <div className="max-w-5xl mx-auto">
              <GameCard
                id={preview.matchup_id}
                sport="mlb"
                homeTeam={preview.home_team}
                awayTeam={preview.away_team}
                startTime={preview.game_time_ct}
                isAdmin={isAdmin}
                isPremium={false}
                isPreviewGame
                variant="regular"
                homeMarketMoneyline={preview.home_market_ml}
                awayMarketMoneyline={preview.away_market_ml}
                homePredictedOdds={preview.home_pred_ml}
                awayPredictedOdds={preview.away_pred_ml}
                homePredictedPct={preview.home_pred_pct}
                awayPredictedPct={preview.away_pred_pct}
                homePitcher={preview.home_pitcher}
                awayPitcher={preview.away_pitcher}
              />
            </div>
          </section>
        )}

        {/* Upsell banner */}
        {isLocked && <PremiumBanner />}

        {/* Info alert */}
        <Alert className="mb-6 bg-muted">
          <Info className="h-4 w-4" />
          <AlertTitle>MLB Predictions</AlertTitle>
          <AlertDescription>
            Using live data from the <code>mlb_predictions</code> table and current market odds.
          </AlertDescription>
        </Alert>

        {/* Main table or locked card */}
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="h-10 w-10 animate-spin mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading MLB predictions…</p>
          </div>
        ) : access === "full" ? (
          <div>
            <h2 className="text-xl font-bold mb-4">All MLB Games</h2>
            <MlbPredictionsTable predictions={predRows} isLoading={false} />
          </div>
        ) : (
          <div className="bg-card border rounded-lg p-8 text-center">
            <Lock className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium mb-2">Premium Content Locked</h3>
            <p className="text-muted-foreground mb-4">
              Upgrade to a premium account to see all MLB predictions and detailed analytics.
            </p>
            <Button onClick={()=>window.location.href='/pricing'}>Upgrade Now</Button>
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
              <p><strong>Predicted Odds:</strong> from <code>mlb_predictions.moneyline</code></p>
              <p><strong>Market / Predicted Implied %:</strong> win-probability conversion</p>
              <p><strong>Edge %:</strong> difference between predicted and market implied percentages</p>
            </div>
            <div className="text-xs text-muted-foreground">
              <p>Last updated: {generatedDate || today}</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default MlbDashboard;
