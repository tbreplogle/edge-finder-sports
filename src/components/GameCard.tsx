
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Clock, LockIcon, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface GameProps {
  // Core identifier
  id?: string;
  matchup_id?: string;
  game_id?: string;
  
  // Sport type
  sport?: "nfl" | "ncaaf" | "ncaab" | "mlb";
  
  // Team information (support both formats)
  homeTeam?: string;
  awayTeam?: string;
  home_team?: string;
  away_team?: string;
  
  // Time information (support both formats)
  startTime?: string;
  game_time_ct?: string;
  
  // Odds & market information
  marketMoneyline?: number | null;
  marketImpliedPct?: number | null;
  predictedOdds?: number | null;
  predictedImpliedPct?: number | null;
  edgePct?: number | null;
  
  // Team-specific odds fields
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
  
  // Additional information
  home_pitcher?: string | null;
  away_pitcher?: string | null;
  
  // Display & access control
  isPremium?: boolean;
  isPreviewGame?: boolean;
  isAdmin: boolean;
  isPaid: boolean;
  variant?: "regular" | "featured";
}

export function GameCard({
  // Use default values and handle both property naming formats
  sport = "mlb",
  homeTeam,
  awayTeam,
  home_team,
  away_team,
  startTime,
  game_time_ct,
  
  // Market data
  marketMoneyline,
  marketImpliedPct,
  predictedOdds,
  predictedImpliedPct,
  edgePct,
  
  // Team-specific odds
  home_market_ml,
  away_market_ml,
  home_market_pct,
  away_market_pct,
  home_pred_ml,
  away_pred_ml,
  home_pred_pct,
  away_pred_pct,
  home_edge_pct,
  away_edge_pct,
  
  // Display flags
  isPremium = false,
  isPreviewGame = false,
  isAdmin,
  isPaid,
  variant = "regular",
}: GameProps) {
  const [open, setOpen] = useState(false);

  // Set actual team names, supporting both property naming styles
  const actualHomeTeam = homeTeam || home_team || "Home Team";
  const actualAwayTeam = awayTeam || away_team || "Away Team";
  
  // Set actual time, supporting both property formats
  const gameTime = startTime || game_time_ct || new Date().toISOString();

  const locked = !isAdmin && isPremium && !isPaid;
  
  // Use team-specific edge if available, otherwise use general edge
  const hasEdge = home_edge_pct != null || away_edge_pct != null || edgePct != null;
  const positive = hasEdge && (home_edge_pct! > 0 || edgePct! > 0); // Oversimplified but works for display

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
          {actualAwayTeam} @ {actualHomeTeam}
        </h3>

        {/* ---------- time ---------- */}
        <div
          className={cn(
            "flex items-center text-sm mb-4",
            locked ? "text-slate-400" : "text-muted-foreground"
          )}
        >
          <Clock className="w-4 h-4 mr-1" />
          {new Date(gameTime).toLocaleString("en-US", {
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
            {actualAwayTeam}
          </div>
          <div className="text-center">
            <div className={locked ? "text-slate-400" : ""}>
              {fmtML(away_market_ml ?? marketMoneyline)}
            </div>
            {away_market_ml != null && (
              <div className="text-xs text-muted-foreground">
                {fmtPct(away_market_pct ?? marketImpliedPct)}
              </div>
            )}
          </div>
          <div className="text-center">
            <div className={locked ? "text-slate-400" : ""}>
              {fmtML(away_pred_ml ?? predictedOdds)}
            </div>
            {away_pred_pct != null && (
              <div className="text-xs text-muted-foreground">
                {fmtPct(away_pred_pct)}
              </div>
            )}
          </div>

          {variant === "featured" && (
            <div
              className={cn(
                "flex items-center justify-center font-bold",
                away_edge_pct != null && away_edge_pct < 0 && "text-edge-accent",
                away_edge_pct != null && away_edge_pct > 0 && "text-edge-secondary",
                away_edge_pct == null && edgePct != null && !positive && "text-edge-accent",
                away_edge_pct == null && edgePct != null && positive && "text-edge-secondary"
              )}
            >
              {away_edge_pct != null || edgePct != null ? (
                <>
                  {(away_edge_pct ?? edgePct)! > 0 ? <ArrowUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
                  {Math.abs((away_edge_pct ?? edgePct)!).toFixed(1)}%
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
            {actualHomeTeam}
          </div>
          <div className="text-center">
            <div className={locked ? "text-slate-400" : ""}>
              {fmtML(home_market_ml ?? marketMoneyline)}
            </div>
          </div>
          <div className="text-center">
            <div className={locked ? "text-slate-400" : ""}>
              {fmtML(home_pred_ml ?? predictedOdds)}
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
