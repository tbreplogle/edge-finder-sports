import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { SportTabs } from "@/components/SportTabs";
import { Button } from "@/components/ui/button";
import { GameCard } from "@/components/GameCard";
import { FeaturedGame } from "@/components/FeaturedGame";
import { ProcessedMlbPrediction, fetchMlbPredictions } from "@/utils/fetchMlbPredictions";

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

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) {
      try { setAdmin(JSON.parse(u).is_admin === true); } catch { /* noop */ }
    }
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const rows = await fetchMlbPredictions();
        setGames(sortGames(rows, sortKey));
      } catch (e) {
        console.error(e);
        toast.error("Failed to load MLB predictions");
        setGames([]);
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
              <GameCard key={g.matchup_id} {...g} isAdmin={admin} />
            ))}
          </div>
        )}

        <FeaturedGame />
      </div>
    </AppLayout>
  );
}
