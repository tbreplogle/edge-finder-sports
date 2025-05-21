// src/pages/MlbDashboard.tsx
import { useState, useEffect } from "react"
import { AppLayout } from "@/components/AppLayout"
import { Button } from "@/components/ui/button"
import { Calendar, RefreshCw, Info, Trophy, Lock } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { format } from "date-fns"
import { GameCard } from "@/components/GameCard"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { PremiumBanner } from "@/components/PremiumBanner"
import { usePageAccess } from "@/lib/usePageAccess"
import {
  fetchMlbPredictions,
  ProcessedMlbPrediction
} from "@/utils/fetchMlbPredictions"

export default function MlbDashboard() {
  const { toast } = useToast()

  /* ─────────────────── access control ─────────────────── */
  const access = usePageAccess("mlb_dashboard")
  if (access === "none") return null
  const isLocked = access !== "full"

  /* ─────────────────── state ───────────────────────────── */
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [generatedDate, setGeneratedDate] = useState<string>("")

  const [predictions, setPredictions] = useState<ProcessedMlbPrediction[]>([])
  const [featured , setFeatured] = useState<ProcessedMlbPrediction | null>(null)
  const [preview  , setPreview ] = useState<ProcessedMlbPrediction | null>(null)

  /* ─────────────────── fetcher ─────────────────────────── */
  const load = async (force = false) => {
    force ? setRefreshing(true) : setLoading(true)

    try {
      const data = await fetchMlbPredictions()
      console.log("🔮 MLB predictions payload:", data)
      setGeneratedDate(format(new Date(), "MMM d, yyyy"))

      if (data.length) {
        /* 1) biggest absolute edge  → featured  */
        const top = [...data].sort((a, b) => {
          const eA = Math.max(Math.abs(a.home_edge_pct ?? 0), Math.abs(a.away_edge_pct ?? 0))
          const eB = Math.max(Math.abs(b.home_edge_pct ?? 0), Math.abs(b.away_edge_pct ?? 0))
          return eB - eA
        })[0]
        setFeatured(top)

        /* 2) earliest non-featured   → preview   */
        const rest  = data.filter(g => g.matchup_id !== top.matchup_id)
        const next  = rest.sort(
          (a, b) => new Date(a.game_time_ct).getTime() - new Date(b.game_time_ct).getTime()
        )[0] ?? null
        setPreview(next)

        setPredictions(data)
      } else {
        setPredictions([])
      }
    } catch (err: any) {
      console.error("Error fetching MLB predictions:", err)
      toast({
        title: "Error",
        description: "Failed to load MLB predictions. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])      // eslint-disable-line react-hooks/exhaustive-deps
  const handleRefresh = () => load(true)

  /* ─────────────────── render ──────────────────────────── */
  return (
    <AppLayout isAuthenticated>
      <div className="container py-8">
        {/* header */}
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
            <Button variant="outline" className="flex items-center gap-2"
              onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
            </Button>

            <Button variant="outline" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{generatedDate}</span>
            </Button>
          </div>
        </div>

        {/* spinners */}
        {loading && (
          <div className="text-center py-12">
            <RefreshCw className="h-10 w-10 animate-spin mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading MLB predictions…</p>
          </div>
        )}

        {/* featured / preview cards */}
        {!loading && featured && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-5 w-5 text-edge-secondary" />
              <h2 className="text-xl font-bold">Game of the Day</h2>
            </div>

            <GameCard
              {...featured}
              /* NEW props ↓ */
              home_market_pct={featured.home_market_pct}
              away_market_pct={featured.away_market_pct}
              homeEdgePct={featured.home_edge_pct}
              awayEdgePct={featured.away_edge_pct}
              /* common flags */
              isAdmin={access === "full"}
              isFeatured
              sport="mlb"
            />
          </section>
        )}

        {!loading && preview && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-5 w-5" />
              <h2 className="text-xl font-bold">Free Preview Game</h2>
            </div>

            <GameCard
              {...preview}
              home_market_pct={preview.home_market_pct}
              away_market_pct={preview.away_market_pct}
              homeEdgePct={preview.home_edge_pct}
              awayEdgePct={preview.away_edge_pct}
              isAdmin={access === "full"}
              isPreviewGame
              sport="mlb"
            />
          </section>
        )}

        {/* upsell banner */}
        {!loading && isLocked && <PremiumBanner />}

        {/* info alert */}
        {!loading && (
          <Alert className="mb-6 bg-muted">
            <Info className="h-4 w-4" />
            <AlertTitle>MLB Predictions</AlertTitle>
            <AlertDescription>
              Using live data from the <code>mlb_predictions</code> table and current market odds.
            </AlertDescription>
          </Alert>
        )}

        {/* full grid or locked card */}
        {!loading &&
          (access === "full" ? (
            <div>
              <h2 className="text-xl font-bold mb-4">All MLB Games</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {predictions.map(p => (
                  <GameCard
                    key={p.matchup_id}
                    {...p}
                    home_market_pct={p.home_market_pct}
                    away_market_pct={p.away_market_pct}
                    homeEdgePct={p.home_edge_pct}
                    awayEdgePct={p.away_edge_pct}
                    isAdmin
                    sport="mlb"
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-card border rounded-lg p-8 text-center">
              <Lock className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-medium mb-2">Premium Content Locked</h3>
              <p className="text-muted-foreground mb-4">
                Upgrade to see all MLB predictions and detailed analytics.
              </p>
              <Button onClick={() => (window.location.href = "/pricing")}>
                Upgrade Now
              </Button>
            </div>
          ))}

        {/* legend */}
        {!loading && (
          <div className="mt-8 p-4 border rounded-lg bg-card">
            <h3 className="font-medium mb-2">Legend</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-edge-mlb rounded-full" />
                <span className="font-medium">MLB</span>
              </div>
              <div>
                <p><strong>Predicted Odds:</strong> from <code>mlb_predictions.moneyline</code></p>
                <p><strong>Market / Predicted %:</strong> implied probability</p>
                <p><strong>Edge %:</strong> predicted − market %</p>
              </div>
              <div><p>Last updated: {generatedDate}</p></div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
