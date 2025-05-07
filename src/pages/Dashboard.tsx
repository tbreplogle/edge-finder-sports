import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { FeaturedGame } from "@/components/FeaturedGame";
import { SportTabs } from "@/components/SportTabs";
import { CalendarIcon, ArrowDownUp } from "lucide-react";
import { GameCard } from "@/components/GameCard";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  fetchMlbPredictions,
  ProcessedMlbPrediction
} from "@/utils/fetchMlbPredictions";

interface GameData {
  id: string;
  sport: "nfl" | "ncaaf" | "ncaab" | "mlb";
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  marketMoneyline?: number | null;
  marketImpliedPct?: number | null;
  predictedOdds?: number | null;
  predictedImpliedPct?: number | null;
  edgePct?: number | null;
  isPremium?: boolean;
  isPreviewGame?: boolean;
}

const sampleGames: GameData[] = [
  { id: "1", sport: "nfl", homeTeam: "Chiefs",  awayTeam: "Eagles", startTime: "2024-09-08T19:20:00", edgePct: 1.2 },
  { id: "2", sport: "ncaaf", homeTeam: "Alabama",awayTeam: "Georgia",startTime: "2024-09-14T15:30:00", edgePct: 0.9 },
  { id: "3", sport: "ncaab", homeTeam: "Duke",   awayTeam: "UNC",    startTime: "2024-11-28T21:00:00", edgePct: 1.5 },
];

export default function Dashboard() {
  const [activeSport, setActiveSport] = useState<GameData["sport"]>("mlb");
  const [games, setGames]         = useState<GameData[]>([]);
  const [loading, setLoading]     = useState(true);
  const [sortOrder, setSortOrder] = useState<"asc"|"desc">("desc");
  const [isAdmin, setIsAdmin]     = useState(false);
  const [isPaid, setIsPaid]       = useState(false);

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) {
      try {
        const user = JSON.parse(u);
        setIsAdmin(user.is_admin === true);
        setIsPaid(user.role === "premium" || user.is_admin === true);
      } catch {}
    }
    if (activeSport === "mlb") {
      loadMlb();
    } else {
      const filtered = sampleGames.filter(g => g.sport === activeSport);
      setGames(sort(filtered));
      setLoading(false);
    }
  }, [activeSport]);

  async function loadMlb() {
    setLoading(true);
    try {
      const preds = await fetchMlbPredictions();
      const out: GameData[] = preds.map(p => ({
        id: p.matchup_id,
        sport: "mlb",
        homeTeam: p.home_team,
        awayTeam: p.away_team,
        startTime: p.game_date,
        marketMoneyline: p.market_ml,
        marketImpliedPct: p.market_implied_pct != null ? p.market_implied_pct * 100 : null,
        predictedOdds: p.moneyline,
        predictedImpliedPct: p.predicted_implied_pct != null ? p.predicted_implied_pct * 100 : null,
        edgePct: p.edge_pct != null ? p.edge_pct * 100 : null,
        isPremium: !isAdmin && Math.abs(p.edge_pct || 0) > 0.02
      }));
      setGames(sort(out));
    } catch (e) {
      console.error(e);
      toast.error("Failed to load MLB predictions");
      setGames([]);
    } finally {
      setLoading(false);
    }
  }

  function sort(list: GameData[]) {
    return [...list].sort((a, b) => {
      const ea = Math.abs(a.edgePct || 0),
            eb = Math.abs(b.edgePct || 0);
      return sortOrder === "desc" ? eb - ea : ea - eb;
    });
  }

  function toggleSort() {
    setSortOrder(o => o === "desc" ? "asc" : "desc");
    setGames(sort(games));
  }

  const preview = !isAdmin && !isPaid
    ? [...games].sort((a,b)=>Math.abs(b.edgePct||0)-Math.abs(a.edgePct||0))[0]
    : null;
  const shown = preview ? games.filter(g=>g.id!==preview.id) : games;

  return (
    <AppLayout>
      <div className="container mx-auto py-8 space-y-6">
        <div className="md:grid md:grid-cols-3 md:gap-6">
          <div className="md:col-span-2">
            <h1 className="text-3xl font-bold">Today's Predictions</h1>
            <div className="flex items-center text-muted-foreground my-2">
              <CalendarIcon className="mr-2 h-4 w-4" />
              <span>{format(new Date(), "EEEE, MMMM d")}</span>
            </div>

            <SportTabs activeTab={activeSport} onTabChange={setActiveSport} />

            <div className="flex justify-between items-center mt-4 mb-2">
              <h2 className="text-xl font-semibold">{activeSport.toUpperCase()} Games</h2>
              <Button variant="outline" size="sm" onClick={toggleSort} className="flex items-center gap-1">
                <ArrowDownUp className="h-4 w-4" />
                {sortOrder==="desc" ? "Highest" : "Lowest"} Edge
              </Button>
            </div>

            {loading ? (
              <div className="grid md:grid-cols-2 gap-4">
                {[1,2,3,4].map(i=>(
                  <div key={i} className="h-40 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {preview && (
                  <div className="mb-4">
                    <h3 className="font-medium mb-1">Preview Game</h3>
                    <GameCard {...preview} isAdmin={isAdmin} isPaid={isPaid} isPreviewGame />
                  </div>
                )}
                <div className="grid md:grid-cols-2 gap-4">
                  {shown.map(g=>(
                    <GameCard key={g.id} {...g} isAdmin={isAdmin} isPaid={isPaid} />
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="space-y-6">
            <FeaturedGame />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
