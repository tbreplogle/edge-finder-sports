
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Clock, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProcessedMlbPrediction } from "@/utils/fetchMlbPredictions";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const ml  = (v: number | null) => (v == null ? "—" : v > 0 ? `+${v}` : `${v}`);
const edgeClr = (v: number | null) =>
  v == null ? "" : v > 0 ? "text-edge-secondary" : "text-edge-accent";

export interface CardProps extends ProcessedMlbPrediction {
  isAdmin: boolean;
  isFeatured?: boolean;
}

export function GameCard(p: CardProps) {
  return (
    <Card className={cn("edge-card", p.isFeatured && "border-0 shadow-lg")}>
      <CardContent className={cn("p-4 space-y-2", p.isFeatured && "bg-transparent")}>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className={cn("mb-1", p.isFeatured && "bg-black/30 text-white border-white/20")}>MLB</Badge>
          {p.isFeatured && (
            <Badge variant="secondary" className="flex gap-1 items-center">
              <Trophy className="w-3 h-3" />
              <span>Game of the Day</span>
            </Badge>
          )}
        </div>

        <h3 className={cn("text-lg font-bold", p.isFeatured && "text-white")}>{p.away_team} @ {p.home_team}</h3>
        <div className={cn("flex items-center text-sm text-muted-foreground mb-2", p.isFeatured && "text-white/80")}>
          <Clock className="w-3 h-3 mr-1" />
          {new Date(p.game_time_ct).toLocaleString("en-US", {
            weekday: "short", month: "short", day: "numeric",
            hour: "numeric", minute: "2-digit", timeZone: "America/Chicago"
          })}
        </div>

        {/* header row */}
        <div className={cn("grid grid-cols-4 text-xs text-muted-foreground mb-1", p.isFeatured && "text-white/70")}>
          <div></div>
          <div className="text-center">Market</div>
          <div className="text-center">Predicted</div>
          <div className="text-center">Edge</div>
        </div>

        {/* away */}
        <div className={cn("grid grid-cols-4 items-center mb-1", p.isFeatured && "text-white")}>
          <div>
            <span className="font-medium">{p.away_team}</span><br/>
            <span className={cn("text-xs text-muted-foreground", p.isFeatured && "text-white/70")}>{p.away_pitcher ?? "TBD"}</span>
          </div>
          <div className="text-center">
            {ml(p.away_market_ml)}<br/><span className="text-xs">{pct(p.away_market_pct)}</span>
          </div>
          <div className="text-center">
            {ml(p.away_pred_ml)}<br/><span className="text-xs">{pct(p.away_pred_pct)}</span>
          </div>
          <div className={cn("text-center flex items-center justify-center gap-1", 
                         !p.isFeatured ? edgeClr(p.away_edge_pct) : "text-white")}>
            {p.away_edge_pct == null ? "—" : (
              <>
                {p.away_edge_pct > 0 ? <ArrowUp className="w-4 h-4"/> : <ArrowDown className="w-4 h-4"/>}
                {(p.away_edge_pct * 100).toFixed(1)}%
              </>
            )}
          </div>
        </div>

        {/* home */}
        <div className={cn("grid grid-cols-4 items-center", p.isFeatured && "text-white")}>
          <div>
            <span className="font-medium">{p.home_team}</span><br/>
            <span className={cn("text-xs text-muted-foreground", p.isFeatured && "text-white/70")}>{p.home_pitcher ?? "TBD"}</span>
          </div>
          <div className="text-center">
            {ml(p.home_market_ml)}<br/><span className="text-xs">{pct(p.home_market_pct)}</span>
          </div>
          <div className="text-center">
            {ml(p.home_pred_ml)}<br/><span className="text-xs">{pct(p.home_pred_pct)}</span>
          </div>
          <div className={cn("text-center flex items-center justify-center gap-1", 
                         !p.isFeatured ? edgeClr(p.home_edge_pct) : "text-white")}>
            {p.home_edge_pct == null ? "—" : (
              <>
                {p.home_edge_pct > 0 ? <ArrowUp className="w-4 h-4"/> : <ArrowDown className="w-4 h-4"/>}
                {(p.home_edge_pct * 100).toFixed(1)}%
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
