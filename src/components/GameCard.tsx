import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProcessedMlbPrediction } from "@/utils/fetchMlbPredictions";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const ml  = (v: number | null) => (v == null ? "—" : v > 0 ? `+${v}` : `${v}`);
const edgeClr = (v: number | null) =>
  v == null ? "" : v > 0 ? "text-edge-secondary" : "text-edge-accent";

export interface CardProps extends ProcessedMlbPrediction {
  isAdmin: boolean;
}

export function GameCard(p: CardProps) {
  return (
    <Card className="edge-card">
      <CardContent className="p-4 space-y-2">
        <Badge variant="outline" className="mb-1">MLB</Badge>

        <h3 className="text-lg font-bold">{p.away_team} @ {p.home_team}</h3>
        <div className="flex items-center text-sm text-muted-foreground mb-2">
          <Clock className="w-3 h-3 mr-1" />
          {new Date(p.game_time_ct).toLocaleString("en-US", {
            weekday: "short", month: "short", day: "numeric",
            hour: "numeric", minute: "2-digit", timeZone: "America/Chicago"
          })}
        </div>

        {/* header row */}
        <div className="grid grid-cols-4 text-xs text-muted-foreground mb-1">
          <div></div>
          <div className="text-center">Market</div>
          <div className="text-center">Predicted</div>
          <div className="text-center">Edge</div>
        </div>

        {/* away */}
        <div className="grid grid-cols-4 items-center mb-1">
          <div>
            <span className="font-medium">{p.away_team}</span><br/>
            <span className="text-xs text-muted-foreground">{p.away_pitcher ?? "TBD"}</span>
          </div>
          <div className="text-center">
            {ml(p.away_market_ml)}<br/><span className="text-xs">{pct(p.away_market_pct)}</span>
          </div>
          <div className="text-center">
            {ml(p.away_pred_ml)}<br/><span className="text-xs">{pct(p.away_pred_pct)}</span>
          </div>
          <div className={cn("text-center flex items-center justify-center gap-1", edgeClr(p.away_edge_pct))}>
            {p.away_edge_pct == null ? "—" : (
              <>
                {p.away_edge_pct > 0 ? <ArrowUp className="w-4 h-4"/> : <ArrowDown className="w-4 h-4"/>}
                {(p.away_edge_pct * 100).toFixed(1)}%
              </>
            )}
          </div>
        </div>

        {/* home */}
        <div className="grid grid-cols-4 items-center">
          <div>
            <span className="font-medium">{p.home_team}</span><br/>
            <span className="text-xs text-muted-foreground">{p.home_pitcher ?? "TBD"}</span>
          </div>
          <div className="text-center">
            {ml(p.home_market_ml)}<br/><span className="text-xs">{pct(p.home_market_pct)}</span>
          </div>
          <div className="text-center">
            {ml(p.home_pred_ml)}<br/><span className="text-xs">{pct(p.home_pred_pct)}</span>
          </div>
          <div className={cn("text-center flex items-center justify-center gap-1", edgeClr(p.home_edge_pct))}>
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
