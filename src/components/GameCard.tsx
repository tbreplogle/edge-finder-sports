import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Clock } from "lucide-react";
import { ProcessedMlbPrediction } from "@/utils/fetchMlbPredictions";
import { cn } from "@/lib/utils";

/* display helpers */
const pct = (v:number|null)=>v==null?"N/A":`${Math.round(v*100)}%`;
const ml  = (v:number|null)=>v==null?"N/A":v>0?`+${v}`:`${v}`;
const edgeColor = (e:number|null)=> e==null?"" : e>0?"text-edge-secondary":"text-edge-accent";

export interface GameCardProps extends ProcessedMlbPrediction { isAdmin:boolean }

export function GameCard(p:GameCardProps) {
  return (
    <Card className="edge-card">
      <CardContent className="p-4 space-y-2">
        <div className="flex justify-between">
          <Badge variant="outline">MLB</Badge>
        </div>

        <h3 className="text-lg font-bold">{p.away_team} @ {p.home_team}</h3>
        <div className="flex items-center text-sm text-muted-foreground">
          <Clock className="w-3 h-3 mr-1"/>
          {new Date(p.game_time_ct).toLocaleString("en-US",{
            weekday:"short", month:"short", day:"numeric",
            hour:"numeric", minute:"2-digit", timeZone:"America/Chicago"
          })}
        </div>

        <div className="grid grid-cols-3 text-xs mt-4">
          <div></div><div className="text-center">Market</div><div className="text-center">Predicted</div>
        </div>

        {/* AWAY row */}
        <div className="grid grid-cols-3 items-center py-0.5">
          <span className="font-medium">{p.away_team}</span>
          <span className="text-center">
            {ml(p.away_market_ml)}<br/>{pct(p.away_market_pct)}
          </span>
          <span className="text-center">
            {ml(p.away_pred_ml)}<br/>{pct(p.away_pred_pct)}
          </span>
        </div>

        {/* HOME row */}
        <div className="grid grid-cols-3 items-center py-0.5">
          <span className="font-medium">{p.home_team}</span>
          <span className="text-center">
            {ml(p.home_market_ml)}<br/>{pct(p.home_market_pct)}
          </span>
          <span className="text-center">
            {ml(p.home_pred_ml)}<br/>{pct(p.home_pred_pct)}
          </span>
        </div>

        {/* edge row */}
        <div className="grid grid-cols-3 mt-3">
          <span className="text-sm text-muted-foreground">Edge</span>
          <span className={cn("flex items-center justify-center gap-1",edgeColor(p.home_edge_pct))}>
            {p.home_edge_pct==null?"N/A":<>
              {p.home_edge_pct>0?<ArrowUp className="w-4 h-4"/>:<ArrowDown className="w-4 h-4"/>}
              {(p.home_edge_pct*100).toFixed(1)}%
            </>}
          </span>
          <span className={cn("flex items-center justify-center gap-1",edgeColor(p.away_edge_pct))}>
            {p.away_edge_pct==null?"N/A":<>
              {p.away_edge_pct>0?<ArrowUp className="w-4 h-4"/>:<ArrowDown className="w-4 h-4"/>}
              {(p.away_edge_pct*100).toFixed(1)}%
            </>}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
