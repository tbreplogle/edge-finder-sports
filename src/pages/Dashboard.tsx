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
  predictedOdds?: number | null;
  edgePct?: number | null;
  confidencePct?: number | null;
  isPremium?: boolean;
  isPreviewGame?: boolean;
}

const sampleGames: GameData[] = [
  {
    id: "1",
    sport: "nfl",
    homeTeam: "Chiefs",
    awayTeam: "Eagles",
    startTime: "2024-09-08T19:20:00",
    edgePct: 1.2,
    confidencePct: 65,
    isPremium: true
  },
  {
    id: "2",
    sport: "ncaaf",
    homeTeam: "Alabama",
    awayTeam: "Georgia",
    startTime: "2024-09-14T15:30:00",
    edgePct: 0.9,
    confidencePct: 58,
    isPremium: false
  },
  {
    id: "3",
    sport: "ncaab",
    homeTeam: "Duke",
    awayTeam: "UNC",
    startTime: "2024-11-28T21:00:00",
    edgePct: 1.5,
    confidencePct: 70,
    isPremium: true
  }
];

const Dashboard = () => {
  const [activeSport, setActiveSport] = useState< GameData["sport"] >("mlb");
  const [games, setGames]           = useState< GameData[] >([]);
  const [loading, setLoading]       = useState<boolean>(true);
  const [sortOrder, setSortOrder]   = useState< "asc" | "desc" >("desc");
  const [isAdmin, setIsAdmin]       = useState<boolean>(false);
  const [isPaid, setIsPaid]         = useState<boolean>(false);

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
      fetchMlbData();
    } else {
      const filtered = sampleGames.filter(g => g.sport === activeSport);
      setGames(sortGames(filtered));
      setLoading(false);
    }
  }, [activeSport]);

  const fetchMlbData = async () => {
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
        predictedOdds: p.moneyline,
        edgePct: p.edge_pct != null ? p.edge_pct * 100 : null,
        confidencePct: p.predicted_implied_pct != null ? p.predicted_implied_pct * 100 : null,
        isPremium: !isAdmin && Math.abs(p.edge_pct || 0) > 0.02
      }));
      setGames(sortGames(out));
    } catch (e) {
      console.error(e);
      toast.error("Failed to load MLB predictions");
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  const sortGames = (arr: GameData[]) => {
    return [...arr].sort((a, b) => {
      const ea = Math.abs(a.edgePct || 0);
      const eb = Math.abs(b.edgePct || 0);
      return sortOrder === "desc" ? eb - ea : ea - eb;
    });
  };

  const handleToggleSort = () => {
    setSortOrder(o => (o === "desc" ? "asc" : "desc"));
    setGames(sortGames(games));
  };

  // single preview game for guests
  const previewGame = (() => {
    if (isPaid || isAdmin) return null;
    const visible = games.filter(g => !g.isPreviewGame);
    if (!visible.length) return null;
    const best = [...visible].sort((a, b) => (Math.abs(b.edgePct || 0) - Math.abs(a.edgePct || 0)))[0];
    return { ...best, isPreviewGame: true };
  })();

  const filteredGames = previewGame
    ? games.filter(g => g.id !== previewGame.id)
    : games;

  return (
    <AppLayout>
      <div className="container mx-auto py-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <h1 className="text-3xl font-bold mb-2">Today's Predictions</h1>
            <div className="flex items-center text-muted-foreground mb-4">
              <CalendarIcon className="mr-2 h-4 w-4" />
              <span>{format(new Date(), "EEEE, MMMM d")}</span>
            </div>

            <SportTabs activeTab={activeSport} onTabChange={setActiveSport} />

            <div className="flex justify-between items-center my-4">
              <h2 className="text-xl font-semibold">{activeSport.toUpperCase()} Games</h2>
              <Button variant="outline" size="sm" onClick={handleToggleSort} className="flex items-center gap-2">
                <ArrowDownUp className="h-4 w-4" />
                Sort by {sortOrder === "desc" ? "Highest" : "Lowest"} Edge
              </Button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-40 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {!isPaid && !isAdmin && previewGame && (
                  <div className="mb-4">
                    <h3 className="font-medium mb-2">Preview Game</h3>
                    <GameCard {...previewGame} isAdmin={isAdmin} isPaid={isPaid} />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredGames.map(game => (
                    <GameCard
                      key={game.id}
                      {...game}
                      isAdmin={isAdmin}
                      isPaid={isPaid}
                    />
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
};

export default Dashboard;
