import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Clock, Trophy } from "lucide-react";
import { ArrowUp, ArrowDown, Clock, Trophy, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProcessedMlbPrediction } from "@/utils/fetchMlbPredictions";
import { AspectRatio } from "@/components/ui/aspect-ratio";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const ml  = (v: number | null) => (v == null ? "—" : v > 0 ? `+${v}` : `${v}`);
@@ -16,6 +16,110 @@
}

export function GameCard(p: CardProps) {
  if (p.isFeatured) {
    return (
      <Card className="edge-card border-0 overflow-hidden relative">
        <AspectRatio ratio={16/7} className="bg-gradient-to-r from-edge-primary to-[#1f3356] text-white">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1IiBoZWlnaHQ9IjUiPgo8cmVjdCB3aWR0aD0iNSIgaGVpZ2h0PSI1IiBmaWxsPSIjMDAwIiBvcGFjaXR5PSIwLjA1Ii8+CjwvcGF0dGVybj48L3N2Zz4=')] opacity-15"></div>
          
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge variant="outline" className="bg-black/30 text-white border-white/20">MLB</Badge>
            <Badge variant="secondary" className="flex gap-1 items-center bg-edge-secondary text-white">
              <Trophy className="w-3 h-3" />
              <span>Game of the Day</span>
            </Badge>
          </div>
          
          <div className="absolute top-3 right-3">
            <Badge variant="outline" className="bg-black/30 text-white border-white/20 flex items-center gap-1">
              <Star className="h-3 w-3 text-yellow-300 fill-yellow-300" />
              <span>TOP EDGE</span>
            </Badge>
          </div>
          
          <div className="p-6 flex flex-col justify-between h-full">
            <div>
              <h3 className="text-2xl font-bold">{p.away_team} @ {p.home_team}</h3>
              <div className="flex items-center text-sm text-white/80 mt-1">
                <Clock className="w-3 h-3 mr-1" />
                {new Date(p.game_time_ct).toLocaleString("en-US", {
                  weekday: "short", month: "short", day: "numeric",
                  hour: "numeric", minute: "2-digit", timeZone: "America/Chicago"
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-y-4 mt-4 md:grid-cols-2">
              {/* Team rows */}
              <div className="grid grid-cols-4 items-center">
                <div className="col-span-2">
                  <span className="text-lg font-bold">{p.away_team}</span><br/>
                  <span className="text-sm text-white/70">{p.away_pitcher ?? "TBD"}</span>
                </div>
                <div className="text-center">
                  <div className="text-sm text-white/70">Market</div>
                  <div>{ml(p.away_market_ml)}</div>
                  <div className="text-xs">{pct(p.away_market_pct)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-white/70">Predicted</div>
                  <div>{ml(p.away_pred_ml)}</div>
                  <div className="text-xs">{pct(p.away_pred_pct)}</div>
                </div>
              </div>
              
              <div className="flex items-center justify-center md:justify-end">
                <div className="px-4 py-2 bg-black/30 rounded-lg flex items-center gap-2">
                  <span className="text-sm">Edge</span>
                  <div className="flex items-center gap-1 font-bold">
                    {p.away_edge_pct == null ? "—" : (
                      <>
                        {p.away_edge_pct > 0 ? <ArrowUp className="w-4 h-4"/> : <ArrowDown className="w-4 h-4"/>}
                        {(p.away_edge_pct * 100).toFixed(1)}%
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-4 items-center">
                <div className="col-span-2">
                  <span className="text-lg font-bold">{p.home_team}</span><br/>
                  <span className="text-sm text-white/70">{p.home_pitcher ?? "TBD"}</span>
                </div>
                <div className="text-center">
                  <div className="text-sm text-white/70">Market</div>
                  <div>{ml(p.home_market_ml)}</div>
                  <div className="text-xs">{pct(p.home_market_pct)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-white/70">Predicted</div>
                  <div>{ml(p.home_pred_ml)}</div>
                  <div className="text-xs">{pct(p.home_pred_pct)}</div>
                </div>
              </div>
              
              <div className="flex items-center justify-center md:justify-end">
                <div className="px-4 py-2 bg-black/30 rounded-lg flex items-center gap-2">
                  <span className="text-sm">Edge</span>
                  <div className="flex items-center gap-1 font-bold">
                    {p.home_edge_pct == null ? "—" : (
                      <>
                        {p.home_edge_pct > 0 ? <ArrowUp className="w-4 h-4"/> : <ArrowDown className="w-4 h-4"/>}
                        {(p.home_edge_pct * 100).toFixed(1)}%
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AspectRatio>
      </Card>
    );
  }
  
  // Regular card (not featured) - keep existing code
  return (
    <Card className={cn("edge-card", p.isFeatured && "border-0 shadow-lg")}>
      <CardContent className={cn("p-4 space-y-2", p.isFeatured && "bg-transparent")}>
@@ -59,39 +163,39 @@
            {ml(p.away_pred_ml)}<br/><span className="text-xs">{pct(p.away_pred_pct)}</span>
          </div>
          <div className={cn("text-center flex items-center justify-center gap-1", 
                         !p.isFeatured ? edgeClr(p.away_edge_pct) : "text-white")}>
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
