/* -------------------------------------------------------------------------- */
/*  Dashboard – MLB predictions                                               */
/* -------------------------------------------------------------------------- */
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";          // ← works in all versions
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { SportTabs } from "@/components/SportTabs";
import { GameCard } from "@/components/GameCard";
import { PremiumBanner } from "@/components/PremiumBanner";

import {
  ProcessedMlbPrediction,
  fetchMlbPredictions,
} from "@/utils/fetchMlbPredictions";

/* ───────────────────────── helpers ──────────────────────────── */

const CT_ZONE = "America/Chicago";
type SortKey = "time" | "edgeHigh" | "edgeLow";

/** interpret naïve CT timestamp correctly */
const ctToDate = (ct: string) => toZonedTime(parseISO(ct), CT_ZONE);

const sortGames = (list: ProcessedMlbPrediction[], key: SortKey) => {
  const clone = [...list];
  switch (key) {
    case "time":
      clone.sort(
        (a, b) => ctToDate(a.game_time_ct).getTime() - ctToDate(b.game_time_ct).getTime()
      );
      break;
    case "edgeHigh":
      clone.sort((a, b) => {
        const ea = Math.max(
          Math.abs(a.home_edge_pct ?? 0),
          Math.abs(a.away_edge_pct ?? 0)
        );
        const eb = Math.max(
          Math.abs(b.home_edge_pct ?? 0),
          Math.abs(b.away_edge_pct ?? 0)
        );
        return eb - ea;
      });
      break;
    case "edgeLow":
      clone.sort((a, b) => {
        const ea = Math.max(
          Math.abs(a.home_edge_pct ?? 0),
          Math.abs(a.away_edge_pct ?? 0)
        );
        const eb = Math.max(
          Math.abs(b.home_edge_pct ?? 0),
          Math.abs(b.away_edge_pct ?? 0)
        );
        return ea - eb;
      });
      break;
  }
  return clone;
};

/* ───────────────────────── component ────────────────────────── */

export default function Dashboard() {
  const [games, setGames] = useState<ProcessedMlbPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("time");
  const [admin, setAdmin] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [featuredGame, setFeaturedGame] =
    useState<ProcessedMlbPrediction | null>(null);

  /* user role -------------------------------------------------- */
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      setAdmin(user.is_admin === true);
      setIsPaid(user.role === "premium" || user.is_admin === true);
    } catch {
      /* ignore */
    }
  }, []);

  /* load data -------------------------------------------------- */
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const rows = await fetchMlbPredictions();

        if (rows.length) {
          const [top] = [...rows].sort((a, b) => {
            const ea = Math.max(
              Math.abs(a.home_edge_pct ?? 0),
              Math.abs(a.away_edge_pct ?? 0)
            );
            const eb = Math.max(
              Math.abs(b.home_edge_pct ?? 0),
              Math.abs(b.away_edge_pct ?? 0)
            );
            return eb - ea;
          });
          setFeaturedGame(top);
          setGames(
            sortGames(rows.filter((g) => g.matchup_id !== top.matchup_id), sortKey)
          );
        } else {
          setFeaturedGame(null);
          setGames([]);
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to load MLB predictions");
        setFeaturedGame(null);
        setGames([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sortKey]);

  /* ───────────────────────── render ─────────────────────────── */

  return (
    <AppLayout>
      <div className="container mx-auto py-8 space-y-6">
        <h1 className="text-3xl font-bold">Today's Predictions</h1>

        <div className="flex items-center text-muted-foreground">
          <CalendarIcon className="w-4 h-4 mr-2" />
          <span>{format(new Date(), "eeee, MMMM d")}</span>
        </div>

        <SportTabs activeTab="mlb" onTabChange={() => {}} />

        {/* ── Featured Game ─────────────────────────────────── */}
        {featuredGame && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4">Game of the Day</h2>
            <div className="max-w-4xl mx-auto">
              <GameCard
                variant="featured"
                homeTeam={featuredGame.home_team}
                awayTeam={featuredGame.away_team}
                startTime={featuredGame.game_time_ct}
                isAdmin={admin}
                isPaid={isPaid}
                isPremium={!isPaid && !admin}
                {...featuredGame}
              />
            </div>
          </section>
        )}

        {!isPaid && !admin && <PremiumBanner />}

        {/* ── Sort picker ───────────────────────────────────── */}
        <div className="flex items-center justify-between my-4">
          <h2 className="text-xl font-semibold">MLB Games</h2>
          <select
            className="border rounded-md px-2 py-1 text-sm bg-background"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="time">Game Time</option>
            <option value="edgeHigh">Highest Edge</option>
            <option value="edgeLow">Lowest Edge</option>
          </select>
        </div>

        {/* ── Games grid ────────────────────────────────────── */}
        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-44 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {games.map((g) => (
              <GameCard
                key={g.matchup_id}
                homeTeam={g.home_team}
                awayTeam={g.away_team}
                startTime={g.game_time_ct}
                isAdmin={admin}
                isPaid={isPaid}
                isPremium={!isPaid && !admin}
                {...g}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
