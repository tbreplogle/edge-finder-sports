
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Clock, LockIcon, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface GameProps {
  id: string;
  sport: "nfl"|"ncaaf"|"ncaab"|"mlb";
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  marketMoneyline?: number|null;
  marketImpliedPct?: number|null;
  predictedOdds?: number|null;
  predictedImpliedPct?: number|null;
  edgePct?: number|null;
  isPremium?: boolean;
  isPreviewGame?: boolean;
  isAdmin: boolean;
  isPaid: boolean;
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
  isPaid
}: GameProps) {
  const [open, setOpen] = useState(false);
  const locked = !isAdmin && isPremium && !isPaid;
  const hasEdge = edgePct != null;
  const positive = hasEdge && (edgePct! > 0);

  const fmtML = (v?:number|null) =>
    v == null ? "N/A" : (v>0? `+${v}` : `${v}`);

  return (
    <Card
      className={cn(
        "relative focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
        locked && "opacity-70 pointer-events-none",
        isPreviewGame && "ring-2 ring-edge-secondary ring-opacity-50"
      )}
      tabIndex={0}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-center">
          <Badge variant="outline">{sport.toUpperCase()}</Badge>
          {isPreviewGame && <Badge variant="secondary"><Star className="w-3 h-3" />Preview</Badge>}
        </div>

        <h3 className={cn("mt-2 text-lg font-bold", locked && "text-slate-400")}>
          {awayTeam} @ {homeTeam}
        </h3>
        <div className={cn("flex items-center text-sm mt-1", locked?"text-slate-400":"text-muted-foreground")}>
          <Clock className="w-4 h-4 mr-1" />
          <span>{new Date(startTime).toLocaleString("en-US",{
            weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/Chicago"
          })}</span>
        </div>

        {sport==="mlb" && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <div className={cn("text-sm", locked?"text-slate-400":"text-muted-foreground")}>
                Market Odds
              </div>
              <div className={cn("font-medium", locked&&"text-slate-400")}>
                {fmtML(marketMoneyline)}
              </div>
              {marketImpliedPct != null && (
                <div className="text-xs text-muted-foreground">
                  {marketImpliedPct.toFixed(0)}%
                </div>
              )}
            </div>

            <div>
              <div className={cn("text-sm", locked?"text-slate-400":"text-muted-foreground")}>
                Predicted Odds
              </div>
              <div className={cn("font-medium", locked&&"text-slate-400")}>
                {fmtML(predictedOdds)}
              </div>
              {predictedImpliedPct != null && (
                <div className="text-xs text-muted-foreground">
                  {predictedImpliedPct.toFixed(0)}%
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className={cn("text-sm", locked?"text-slate-400":"text-muted-foreground")}>Edge</div>
          <div className="flex items-center text-lg font-bold">
            {hasEdge ? (
              positive
                ? <ArrowUp className="w-5 h-5 text-edge-secondary" />
                : <ArrowDown className="w-5 h-5 text-edge-accent" />
            ) : <span className="italic">N/A</span>}

            <span className={positive?"text-edge-secondary":"text-edge-accent"}>
              {hasEdge ? edgePct!.toFixed(1) + "%" : ""}
            </span>
          </div>
        </div>
      </CardContent>

      {locked && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-10">
          <LockIcon className="w-6 h-6 text-slate-400 mb-2" />
          <Button onClick={()=>window.location.href="/pricing"}>Unlock</Button>
        </div>
      )}
    </Card>
  );
}
