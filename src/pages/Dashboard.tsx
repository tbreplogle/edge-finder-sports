
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Lock } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { SportTabs } from "@/components/SportTabs";
import { Button } from "@/components/ui/button";
import { GameCard } from "@/components/GameCard";
import { FeaturedGame } from "@/components/FeaturedGame";
import { ProcessedMlbPrediction, fetchMlbPredictions } from "@/utils/fetchMlbPredictions";
import { PremiumBanner } from "@/components/PremiumBanner";

/* sort helpers ------------------------------------------------------------ */
type SortKey = "time" | "edgeHigh" | "edgeLow";
const sortGames = (list: ProcessedMlbPrediction[], key: SortKey) => {
  const clone = [...list];
  switch (key) {
    case "time":
      clone.sort((a, b) => new Date(a.game_time_ct).getTime() - new Date(b.game_time_ct).getTime());
      break;
    case "edgeHigh":
      clone.sort((a, b) => {
        const ea = Math.max(Math.abs(a.home_edge_pct ?? 0), Math.abs(a.away_edge_pct ?? 0));
        const eb = Math.max(Math.abs(b.home_edge_pct ?? 0), Math.abs(b.away_edge_pct ?? 0));
        return eb - ea;
      });
      break;
    case "edgeLow":
      clone.sort((a, b) => {
        const ea = Math.max(Math.abs(a.home_edge_pct ?? 0), Math.abs(a.away_edge_pct ?? 0));
        const eb = Math.max(Math.abs(b.home_edge_pct ?? 0), Math.abs(b.away_edge_pct ?? 0));
        return ea - eb;
      });
      break;
  }
  return clone;
};

/* component ---------------------------------------------------------------- */
export default function Dashboard() {
  const [games, setGames] = useState<ProcessedMlbPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("time");
  const [admin, setAdmin] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [featuredGame, setFeaturedGame] = useState<ProcessedMlbPrediction | null>(null);

  // Check if user is admin or paid user
  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) {
      try {
        const userData = JSON.parse(u);
        setAdmin(userData.is_admin === true);
        setIsPaid(userData.role === "premium" || userData.is_admin === true);
      } catch { /* noop */ }
    }
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const rows = await fetchMlbPredictions();
        
        // Find the game with the highest absolute edge value
        if (rows.length > 0) {
          const highestEdgeGame = [...rows].sort((a, b) => {
            const edgeA = Math.max(Math.abs(a.home_edge_pct ?? 0), Math.abs(a.away_edge_pct ?? 0));
            const edgeB = Math.max(Math.abs(b.home_edge_pct ?? 0), Math.abs(b.away_edge_pct ?? 0));
            return edgeB - edgeA;
          })[0];
          
          setFeaturedGame(highestEdgeGame);
          
          // Remove the featured game from the regular list
          const filteredGames = rows.filter(game => game.matchup_id !== highestEdgeGame.matchup_id);
          setGames(sortGames(filteredGames, sortKey));
        } else {
          setGames([]);
          setFeaturedGame(null);
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to load MLB predictions");
        setGames([]);
        setFeaturedGame(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sortKey]);

  return (
    <AppLayout>
      <div className="container mx-auto py-8 space-y-6">
        <h1 className="text-3xl font-bold">Today's Predictions</h1>
        <div className="flex items-center text-muted-foreground">
          <CalendarIcon className="w-4 h-4 mr-2" />
          <span>{format(new Date(), "EEEE, MMMM d")}</span>
        </div>

        <SportTabs activeTab="mlb" onTabChange={() => {}} />

        {featuredGame && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Game of the Day</h2>
            <div className="max-w-5xl mx-auto">
              {/* Always show featured game with full details */}
              <GameCard 
                {...featuredGame} 
                isAdmin={admin} 
                isFeatured={true} 
                isPremium={false} // Featured game is always accessible
              />
            </div>
          </div>
        )}

        {/* Show premium banner for non-paid users */}
        {!isPaid && !admin && <PremiumBanner />}

        <div className="flex items-center justify-between my-4">
          <h2 className="text-xl font-semibold">MLB Games</h2>

          <select
            className="border rounded-md px-2 py-1 text-sm bg-background"
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
          >
            <option value="time">Game Time</option>
            <option value="edgeHigh">Highest Edge</option>
            <option value="edgeLow">Lowest Edge</option>
          </select>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-44 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {games.map(g => (
              <GameCard 
                key={g.matchup_id} 
                {...g} 
                isAdmin={admin} 
                isPremium={!isPaid && !admin} // Lock content for non-premium/non-admin users
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
