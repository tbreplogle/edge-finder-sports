
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Clock, LockIcon, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface GameProps {
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
  isAdmin: boolean;
  isPaid: boolean;
  /** highlight style for dashboard "Game of the Day" */  
  variant?: "regular" | "featured";
  /** Flag to identify if this is a featured game */
  isFeatured?: boolean;

  /*  split–odds fields  */
  homeMarketMoneyline?: number | null;
  awayMarketMoneyline?: number | null;
  homePredictedOdds?: number | null;
  awayPredictedOdds?: number | null;
  homePredictedPct?: number | null;
  awayPredictedPct?: number | null;
  
  /* MLB specific fields */
  matchup_id?: string;
  game_id?: string; 
  home_team?: string;
  away_team?: string;
  game_time_ct?: string;
  home_market_ml?: number | null;
  away_market_ml?: number | null;
  home_market_pct?: number | null;
  away_market_pct?: number | null;
  home_pred_ml?: number | null;
  away_pred_ml?: number | null;
  home_pred_pct?: number | null;
  away_pred_pct?: number | null;
  home_edge_pct?: number | null;
  away_edge_pct?: number | null;
  home_pitcher?: string | null;
  away_pitcher?: string | null;
}

export function GameCard({
  sport,
  homeTeam,
  awayTeam,
  startTime,
  marketMoneyline,
  marketImpliedPct,
  predictedOdds,
  predictedImpliedPct,
  edgePct,
  isPremium = false,
  isPreviewGame = false,
  isAdmin,
  isPaid,
  variant = "regular",
  /* split odds */
  homeMarketMoneyline,
  awayMarketMoneyline,
  homePredictedOdds,
  awayPredictedOdds,
  homePredictedPct,
  awayPredictedPct,
}: GameProps) {
  const [open, setOpen] = useState(false);

  const locked = !isAdmin && isPremium && !isPaid;
  const hasEdge = edgePct != null;
  const positive = hasEdge && edgePct! > 0;

  const fmtML = (v?: number | null) =>
    v == null ? "N/A" : v > 0 ? `+${v}` : `${v}`;

  const fmtPct = (v?: number | null) =>
    v == null ? "N/A" : `${Math.round(v * 100)}%`;

  /* ---------- classes ---------- */
  const base =
    "relative border rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
  const featuredStyle =
    "bg-gradient-to-br from-slate-800/30 to-slate-800/10 p-6 md:p-8";
  const regularStyle = "p-4";

  return (
    <Card
      className={cn(
        base,
        variant === "featured" ? featuredStyle : regularStyle,
        locked && "opacity-70 pointer-events-none",
        isPreviewGame && "ring-2 ring-edge-secondary ring-opacity-50"
      )}
      tabIndex={0}
    >
      <CardContent className="p-0">
        {/* ---------- header row ---------- */}
        <div className="flex items-center justify-between mb-4">
          <Badge variant="outline">{sport.toUpperCase()}</Badge>
          {isPreviewGame && (
            <Badge variant="secondary">
              <Star className="w-3 h-3 mr-1" />
              Preview
            </Badge>
          )}
        </div>

        {/* ---------- matchup title ---------- */}
        <h3
          className={cn(
            "font-bold",
            variant === "featured" ? "text-2xl md:text-3xl mb-2" : "text-lg",
            locked && "text-slate-400"
          )}
        >
          {awayTeam} @ {homeTeam}
        </h3>

        {/* ---------- time ---------- */}
        <div
          className={cn(
            "flex items-center text-sm mb-4",
            locked ? "text-slate-400" : "text-muted-foreground"
          )}
        >
          <Clock className="w-4 h-4 mr-1" />
          {new Date(startTime).toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/Chicago",
          })}
        </div>

        {/* ---------- odds table ---------- */}
        <div
          className={cn(
            "grid gap-2",
            variant === "featured" ? "grid-cols-5" : "grid-cols-3"
          )}
        >
          {/* empty top‑left cell */}
          <div></div>
          <div className="text-center text-xs font-semibold text-muted-foreground">
            Market
          </div>
          <div className="text-center text-xs font-semibold text-muted-foreground">
            Predicted
          </div>
          {variant === "featured" && (
            <div className="text-center text-xs font-semibold text-muted-foreground col-span-2">
              Edge
            </div>
          )}

          {/* ----- Away row ----- */}
          <div
            className={cn("font-medium", locked && "text-slate-400 text-sm")}
          >
            {awayTeam}
          </div>
          <div className="text-center">
            <div className={locked ? "text-slate-400" : ""}>
              {fmtML(awayMarketMoneyline ?? marketMoneyline)}
            </div>
            {awayMarketMoneyline != null && (
              <div className="text-xs text-muted-foreground">
                {fmtPct(marketImpliedPct)}
              </div>
            )}
          </div>
          <div className="text-center">
            <div className={locked ? "text-slate-400" : ""}>
              {fmtML(awayPredictedOdds ?? predictedOdds)}
            </div>
            {awayPredictedPct != null && (
              <div className="text-xs text-muted-foreground">
                {fmtPct(awayPredictedPct)}
              </div>
            )}
          </div>

          {variant === "featured" && (
            <div
              className={cn(
                "flex items-center justify-center font-bold",
                edgePct != null && !positive && "text-edge-accent",
                edgePct != null && positive && "text-edge-secondary"
              )}
            >
              {edgePct != null ? (
                <>
                  {positive ? <ArrowUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
                  {edgePct.toFixed(1)}%
                </>
              ) : (
                "N/A"
              )}
            </div>
          )}

          {/* ----- Home row ----- */}
          <div
            className={cn("font-medium", locked && "text-slate-400 text-sm")}
          >
            {homeTeam}
          </div>
          <div className="text-center">
            <div className={locked ? "text-slate-400" : ""}>
              {fmtML(homeMarketMoneyline ?? marketMoneyline)}
            </div>
          </div>
          <div className="text-center">
            <div className={locked ? "text-slate-400" : ""}>
              {fmtML(homePredictedOdds ?? predictedOdds)}
            </div>
          </div>
          {variant === "featured" && <div></div>}
        </div>
      </CardContent>

      {/* ---------- lock overlay ---------- */}
      {locked && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-10">
          <LockIcon className="w-8 h-8 text-slate-300 mb-3" />
          <Button size="sm" onClick={() => (window.location.href = "/pricing")}>
            Unlock with Premium
          </Button>
        </div>
      )}
    </Card>
  );
}

