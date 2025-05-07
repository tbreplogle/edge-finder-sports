
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
  // Add separate fields for home/away odds
  homeMarketMoneyline?: number|null;
  awayMarketMoneyline?: number|null;
  homePredictedOdds?: number|null;
  awayPredictedOdds?: number|null;
  homePredictedPct?: number|null;
  awayPredictedPct?: number|null;
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
  // New props for separate team odds
  homeMarketMoneyline,
  awayMarketMoneyline,
  homePredictedOdds,
  awayPredictedOdds,
  homePredictedPct,
  awayPredictedPct
}: GameProps) {
  const [open, setOpen] = useState(false);
  const locked = !isAdmin && isPremium && !isPaid;
  const hasEdge = edgePct != null;
  const positive = hasEdge && (edgePct! > 0);

  const fmtML = (v?:number|null) =>
    v == null ? "N/A" : (v>0? `+${v}` : `${v}`);

  // Format percentage values properly with % sign and rounded to whole number
  const fmtPct = (v?: number|null) =>
    v == null ? "N/A" : `${Math.round(v * 100)}%`;

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
          <div className="mt-4">
            <div className="grid grid-cols-3 gap-1 mb-3">
              <div></div>
              <div className={cn("text-xs font-semibold text-center", locked?"text-slate-400":"text-muted-foreground")}>
                Market Odds
              </div>
              <div className={cn("text-xs font-semibold text-center", locked?"text-slate-400":"text-muted-foreground")}>
                Predicted Odds
              </div>
            </div>
            
            {/* Away Team Row */}
            <div className="grid grid-cols-3 gap-1 mb-2">
              <div className={cn("text-sm font-medium", locked&&"text-slate-400")}>
                {awayTeam}
              </div>
              <div className="text-center">
                <div className={cn("font-medium", locked&&"text-slate-400")}>
                  {fmtML(awayMarketMoneyline || marketMoneyline)}
                </div>
              </div>
              <div className="text-center">
                <div className={cn("font-medium", locked&&"text-slate-400")}>
                  {fmtML(awayPredictedOdds || predictedOdds)}
                </div>
                {awayPredictedPct != null && (
                  <div className="text-xs text-muted-foreground">
                    {fmtPct(awayPredictedPct)}
                  </div>
                )}
              </div>
            </div>
            
            {/* Home Team Row */}
            <div className="grid grid-cols-3 gap-1">
              <div className={cn("text-sm font-medium", locked&&"text-slate-400")}>
                {homeTeam}
              </div>
              <div className="text-center">
                <div className={cn("font-medium", locked&&"text-slate-400")}>
                  {fmtML(homeMarketMoneyline || marketMoneyline)}
                </div>
              </div>
              <div className="text-center">
                <div className={cn("font-medium", locked&&"text-slate-400")}>
                  {fmtML(homePredictedOdds || predictedOdds)}
                </div>
                {homePredictedPct != null && (
                  <div className="text-xs text-muted-foreground">
                    {fmtPct(homePredictedPct)}
                  </div>
                )}
              </div>
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
