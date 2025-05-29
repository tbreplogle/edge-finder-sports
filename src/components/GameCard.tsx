// src/components/GameCard.tsx
import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowUp, ArrowDown, Clock, Trophy, Star } from "lucide-react"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { ProcessedMlbPrediction } from "@/utils/fetchMlbPredictions"
import { cn } from "@/lib/utils"

export interface GameCardProps extends ProcessedMlbPrediction {
  variant?: "featured" | "regular" | "locked"
}

export function GameCard(p: GameCardProps) {
  const [showInfo, setShowInfo] = useState(false)

  const toPct = (ml: number | null) =>
    ml == null
      ? null
      : ml > 0
      ? 100 / (ml + 100)
      : Math.abs(ml) / (Math.abs(ml) + 100)

  const homePct = p.home_market_pct ?? toPct(p.home_market_ml)
  const awayPct = p.away_market_pct ?? toPct(p.away_market_ml)

  const fmtMl = (v: number | null) =>
    v == null ? "—" : v > 0 ? `+${v}` : `${v}`
  const fmtPct = (v: number | null) =>
    v == null ? "—" : `${Math.round(v * 100)}%`

  // ── FEATURED VARIANT ───────────
  if (p.variant === "featured") {
    return (
      <Card className="overflow-hidden border-0 bg-card shadow-lg relative">
        <AspectRatio
          ratio={16 / 7}
          className="bg-gradient-to-r from-edge-primary to-[#1f3356] text-white"
        >
          {/* ribbons */}
          <div className="absolute top-4 left-4 flex gap-2">
            <Badge variant="outline" className="bg-black/30 border-white/20">
              MLB
            </Badge>
            <Badge
              variant="secondary"
              className="flex items-center gap-1 bg-edge-secondary"
            >
              <Trophy className="w-4 h-4" /> Game of the Day
            </Badge>
          </div>
          <div className="absolute top-4 right-4">
            <Badge
              variant="outline"
              className="flex items-center gap-1 bg-black/30 border-white/20"
            >
              <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" /> TOP
              EDGE
            </Badge>
          </div>

          {/* main content */}
          <div className="pt-12 px-6 pb-6 flex flex-col h-full space-y-8">
            {/* header */}
            <header className="space-y-1 mb-8">
              <h3 className="text-3xl font-extrabold tracking-tight">
                {p.away_team} <span className="opacity-70">@</span>{" "}
                {p.home_team}
              </h3>
              <div className="flex items-center gap-2 text-base text-white/80">
                <Clock className="w-5 h-5" />
                {new Date(p.game_time_ct).toLocaleString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "America/Chicago",
                })}
              </div>
            </header>

            {/* two-columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(["away", "home"] as const).map((side) => {
                const isAway = side === "away"
                const team = isAway ? p.away_team : p.home_team
                const pitcher = isAway ? p.away_pitcher : p.home_pitcher
                const mMl = isAway ? p.away_market_ml : p.home_market_ml
                const mPct = isAway ? awayPct : homePct
                const prMl = isAway ? p.away_pred_ml : p.home_pred_ml
                const prPct = isAway ? p.away_pred_pct : p.home_pred_pct
                const edge = isAway ? p.away_edge_pct : p.home_edge_pct

                return (
                  <div
                    key={side}
                    className="bg-white/10 rounded-lg p-4 flex flex-col space-y-2"
                  >
                    <div>
                      <div className="text-lg font-bold">{team}</div>
                      <div className="text-sm text-white/70">
                        {pitcher ?? "TBD"}
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      {/* Market */}
                      <div className="text-center">
                        <div className="opacity-70">Market</div>
                        <div className="font-medium">{fmtMl(mMl)}</div>
                        <div className="opacity-70">{fmtPct(mPct)}</div>
                      </div>

                      {/* Predicted */}
                      <div className="text-center">
                        <div className="opacity-70">Predicted</div>
                        <div className="font-medium">{fmtMl(prMl)}</div>
                        <div className="opacity-70">{fmtPct(prPct)}</div>
                      </div>

                      {/* Edge */}
                      <div className="text-center">
                        <div className="opacity-70">Edge</div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "mt-1 gap-1 px-3 py-1 text-sm font-semibold",
                            edge == null
                              ? ""
                              : edge > 0
                              ? "text-edge-secondary"
                              : "text-edge-accent"
                          )}
                        >
                          {edge == null
                            ? "—"
                            : edge > 0
                            ? (
                                <>
                                  <ArrowUp className="w-4 h-4 inline" />{" "}
                                  {(edge * 100).toFixed(1)}%
                                </>
                              )
                            : (
                                <>
                                  <ArrowDown className="w-4 h-4 inline" />{" "}
                                  {(edge * 100).toFixed(1)}%
                                </>
                              )}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </AspectRatio>

        {/* More Info toggle */}
        <CardContent className="pt-4">
          <button
            onClick={() => setShowInfo((b) => !b)}
            className="text-sm underline"
          >
            {showInfo ? "Hide Info" : "More Info"}
          </button>
        </CardContent>

        {/* TEAR placeholder */}
        {showInfo && (
          <CardContent className="pt-2">
            <div
              data-type="generic"
              data-url="https://pregame.com/game-center?ts_i=game-center"
            />
          </CardContent>
        )}
      </Card>
    )
  }

  // ── REGULAR / LOCKED ───────────
  const locked = p.variant === "locked"

  return (
    <Card className="edge-card">
      <CardContent className="p-4 space-y-2">
        <Badge variant="outline">MLB</Badge>
        <h3 className="text-lg font-bold">
          {p.away_team} @ {p.home_team}
        </h3>
        <div className="flex items-center text-sm text-muted-foreground mb-2">
          <Clock className="w-3 h-3 mr-1" />
          {new Date(p.game_time_ct).toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/Chicago",
          })}
        </div>

        <div className="grid grid-cols-4 text-xs text-muted-foreground mb-1">
          <div />
          <div className="text-center">Market</div>
          <div className="text-center">Predicted</div>
          <div className="text-center">Edge</div>
        </div>

        {(["away", "home"] as const).map((side) => {
          const isAway = side === "away"
          const mMl = isAway ? p.away_market_ml : p.home_market_ml
          const mPct = isAway ? p.away_market_pct : p.home_market_pct
          const prMl = isAway ? p.away_pred_ml : p.home_pred_ml
          const prPct = isAway ? p.away_pred_pct : p.home_pred_pct
          const edge = isAway ? p.away_edge_pct : p.home_edge_pct
          const tm = isAway ? p.away_team : p.home_team
          const ptc = isAway ? p.away_pitcher : p.home_pitcher

          return (
            <div
              key={side}
              className="grid grid-cols-4 items-center mb-1"
            >
              <div>
                <span className="font-medium">{tm}</span>
                <br />
                <span className="text-xs text-muted-foreground">
                  {ptc ?? "TBD"}
                </span>
              </div>
              <div className="text-center">
                {fmtMl(mMl)}
                <br />
                <span className="text-xs">{fmtPct(mPct)}</span>
              </div>
              <div className="text-center">
                {locked ? (
                  "—"
                ) : (
                  <>
                    {fmtMl(prMl)}
                    <br />
                    <span className="text-xs">{fmtPct(prPct)}</span>
                  </>
                )}
              </div>
              <div
                className={cn(
                  "text-center flex items-center justify-center gap-1",
                  edge == null
                    ? ""
                    : edge > 0
                    ? "text-edge-secondary"
                    : "text-edge-accent"
                )}
              >
                {edge == null || locked ? (
                  "—"
                ) : (
                  <>
                    {edge > 0 ? (
                      <ArrowUp className="w-4 h-4" />
                    ) : (
                      <ArrowDown className="w-4 h-4" />
                    )}
                    {(edge * 100).toFixed(1)}%
                  </>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
