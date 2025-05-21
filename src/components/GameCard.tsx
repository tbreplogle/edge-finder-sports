import { Card, CardContent } from "@/components/ui/card";
import { Badge }            from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Clock, Trophy, Star } from "lucide-react";
import { cn }               from "@/lib/utils";
import { ProcessedMlbPrediction } from "@/utils/fetchMlbPredictions";
import { AspectRatio }      from "@/components/ui/aspect-ratio";

const pct  = (v: number | null) => v == null ? "—" : `${Math.round(v * 100)}%`;
const ml   = (v: number | null) => v == null ? "—" : v > 0 ? `+${v}` : `${v}`;
const edgeClr = (v: number | null) =>
  v == null ? "" : v > 0 ? "text-edge-secondary" : "text-edge-accent";

export interface GameCardProps extends ProcessedMlbPrediction {
  /** visual tweaks supplied by parent */
  variant?: "featured" | "regular" | "locked";
  isAdmin?:  boolean;
  isPremium?: boolean;
  isFeatured?: boolean;
  isPreviewGame?: boolean;
}

export function GameCard(p: GameCardProps) {
  /* ─────────────── FEATURED CARD ─────────────── */
  if (p.variant === "featured") {
    return (
      <Card className="edge-card border-0 overflow-hidden relative">
        <AspectRatio ratio={16/7}
          className="bg-gradient-to-r from-edge-primary to-[#1f3356] text-white">

          {/* ribbons */}
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge variant="outline" className="bg-black/30 text-white border-white/20">MLB</Badge>
            <Badge variant="secondary" className="flex gap-1 items-center bg-edge-secondary text-white">
              <Trophy className="w-3 h-3" /> Game of the Day
            </Badge>
          </div>
          <div className="absolute top-3 right-3">
            <Badge variant="outline" className="bg-black/30 text-white border-white/20 flex items-center gap-1">
              <Star className="h-3 w-3 text-yellow-300 fill-yellow-300" /> TOP EDGE
            </Badge>
          </div>

          {/* content */}
          <div className="p-6 flex flex-col justify-between h-full">
            <header>
              <h3 className="text-2xl font-bold">{p.away_team} @ {p.home_team}</h3>
              <div className="flex items-center text-sm text-white/80 mt-1">
                <Clock className="w-3 h-3 mr-1" />
                {new Date(p.game_time_ct).toLocaleString("en-US", {
                  weekday: "short", month: "short", day: "numeric",
                  hour: "numeric", minute: "2-digit",
                  timeZone: "America/Chicago"
                })}
              </div>
            </header>

            {/* team rows */}
            <div className="grid md:grid-cols-2 gap-y-4 mt-4">
              {["away","home"].map((side) => {
                const isAway = side === "away";
                return (
                  <div key={side} className="grid grid-cols-4 items-center">
                    {/* team / pitcher */}
                    <div className="col-span-2">
                      <span className="text-lg font-bold">
                        {isAway ? p.away_team : p.home_team}
                      </span><br/>
                      <span className="text-sm text-white/70">
                        {isAway ? p.away_pitcher : p.home_pitcher || "TBD"}
                      </span>
                    </div>

                    {/* market */}
                    <div className="text-center">
                      <div className="text-sm text-white/70">Market</div>
                      <div>{ml(isAway ? p.away_market_ml : p.home_market_ml)}</div>
                      <div className="text-xs">{pct(isAway ? p.away_market_pct : p.home_market_pct)}</div>
                    </div>

                    {/* predicted */}
                    <div className="text-center">
                      <div className="text-sm text-white/70">Predicted</div>
                      <div>{ml(isAway ? p.away_pred_ml : p.home_pred_ml)}</div>
                      <div className="text-xs">{pct(isAway ? p.away_pred_pct : p.home_pred_pct)}</div>
                    </div>
                  </div>
                );
              })}

              {/* edge chips */}
              {["away","home"].map((side) => {
                const edge = side === "away" ? p.away_edge_pct : p.home_edge_pct;
                return (
                  <div key={side} className="flex items-center justify-center md:justify-end">
                    <div className="px-4 py-2 bg-black/30 rounded-lg flex items-center gap-2">
                      <span className="text-sm">Edge</span>
                      <div className="flex items-center gap-1 font-bold">
                        {edge == null ? "—" : (
                          <>
                            {edge > 0 ? <ArrowUp className="w-4 h-4"/> : <ArrowDown className="w-4 h-4"/>}
                            {(edge * 100).toFixed(1)}%
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </AspectRatio>
      </Card>
    );
  }

  /* ─────────────── REGULAR / LOCKED CARD ─────────────── */
  const locked = p.variant === "locked";

  return (
    <Card className={cn("edge-card", p.variant === "featured" && "border-0 shadow-lg")}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="mb-1">MLB</Badge>
        </div>

        <h3 className="text-lg font-bold">{p.away_team} @ {p.home_team}</h3>
        <div className="flex items-center text-sm text-muted-foreground mb-2">
          <Clock className="w-3 h-3 mr-1" />
          {new Date(p.game_time_ct).toLocaleString("en-US", {
            weekday: "short", month: "short", day: "numeric",
            hour: "numeric", minute: "2-digit",
            timeZone: "America/Chicago"
          })}
        </div>

        {/* HEADER ROW */}
        <div className="grid grid-cols-4 text-xs text-muted-foreground mb-1">
          <div></div><div className="text-center">Market</div>
          <div className="text-center">Predicted</div>
          <div className="text-center">Edge</div>
        </div>

        {/* TEAMS */}
        {["away","home"].map((side) => {
          const isAway = side === "away";
          const mMl  = isAway ? p.away_market_ml  : p.home_market_ml;
          const mPct = isAway ? p.away_market_pct : p.home_market_pct;
          const pMl  = isAway ? p.away_pred_ml    : p.home_pred_ml;
          const pPct = isAway ? p.away_pred_pct   : p.home_pred_pct;
          const edge = isAway ? p.away_edge_pct   : p.home_edge_pct;
          const tm   = isAway ? p.away_team       : p.home_team;
          const ptc  = isAway ? p.away_pitcher    : p.home_pitcher;

          return (
            <div key={side} className="grid grid-cols-4 items-center mb-1">
              <div>
                <span className="font-medium">{tm}</span><br/>
                <span className="text-xs text-muted-foreground">{ptc ?? "TBD"}</span>
              </div>
              <div className="text-center">
                {ml(mMl)}<br/><span className="text-xs">{pct(mPct)}</span>
              </div>
              <div className="text-center">
                {locked ? "—" : (
                  <>
                    {ml(pMl)}<br/><span className="text-xs">{pct(pPct)}</span>
                  </>
                )}
              </div>
              <div className={cn(
                    "text-center flex items-center justify-center gap-1",
                    edgeClr(edge)
              )}>
                {edge == null || locked ? "—" : (
                  <>
                    {edge > 0 ? <ArrowUp className="w-4 h-4"/> : <ArrowDown className="w-4 h-4"/>}
                    {(edge * 100).toFixed(1)}%
                  </>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
