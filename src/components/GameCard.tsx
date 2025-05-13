
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Clock, Trophy, Star, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProcessedMlbPrediction } from "@/utils/fetchMlbPredictions";
import { AspectRatio } from "@/components/ui/aspect-ratio";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const ml  = (v: number | null) => (v == null ? "—" : v > 0 ? `+${v}` : `${v}`);
const edgeClr = (v: number | null) =>
  v == null ? "" : v > 0 ? "text-edge-secondary" : "text-edge-accent";

export interface CardProps extends ProcessedMlbPrediction {
  isAdmin: boolean;
  isFeatured?: boolean;
  isPremium?: boolean;
}

export function GameCard(p: CardProps) {
  const isLocked = p.isPremium && !p.isAdmin && !p.isFeatured;
  
  if (p.isFeatured) {
    return (
      <Card className="edge-card border-0 overflow-hidden relative">
        <AspectRatio ratio={16/9} className="bg-gradient-to-r from-edge-primary to-[#1f3356] text-white">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1IiBoZWlnaHQ9IjUiPgo8cmVjdCB3aWR0aD0iNSIgaGVpZ2h0PSI1IiBmaWxsPSIjMDAwIiBvcGFjaXR5PSIwLjA1Ii8+CjwvcGF0dGVybj48L3N2Zz4=')] opacity-15"></div>
          
          {/* Top badges */}
          <div className="absolute top-4 left-4 flex gap-2">
            <Badge variant="outline" className="bg-black/30 text-white border-white/20">MLB</Badge>
            <Badge variant="secondary" className="flex gap-1 items-center bg-edge-secondary text-white">
              <Trophy className="w-3 h-3" />
              <span>Game of the Day</span>
            </Badge>
          </div>
          
          <div className="absolute top-4 right-4">
            <Badge variant="outline" className="bg-black/30 text-white border-white/20 flex items-center gap-1">
              <Star className="h-3 w-3 text-yellow-300 fill-yellow-300" />
              <span>TOP EDGE</span>
            </Badge>
          </div>
          
          {/* Main content */}
          <div className="p-6 flex flex-col h-full">
            {/* Teams and time */}
            <div className="mb-6">
              <h3 className="text-3xl font-bold tracking-tight">{p.away_team} @ {p.home_team}</h3>
              <div className="flex items-center text-sm text-white/80 mt-2">
                <Clock className="w-4 h-4 mr-2" />
                {new Date(p.game_time_ct).toLocaleString("en-US", {
                  weekday: "short", month: "short", day: "numeric",
                  hour: "numeric", minute: "2-digit", timeZone: "America/Chicago"
                })}
              </div>
            </div>

            {/* Teams and odds */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Away team section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xl font-bold">{p.away_team}</h4>
                    <p className="text-sm text-white/70">{p.away_pitcher ?? "TBD"}</p>
                  </div>
                  
                  <div className="flex items-center justify-center px-4 py-2 bg-black/20 rounded-lg">
                    <div className="flex items-center gap-1">
                      {p.away_edge_pct && (
                        <>
                          {p.away_edge_pct > 0 ? (
                            <ArrowUp className="w-4 h-4 text-edge-secondary" />
                          ) : (
                            <ArrowDown className="w-4 h-4 text-edge-accent" />
                          )}
                          <span className="font-bold text-lg">
                            {Math.abs(p.away_edge_pct * 100).toFixed(1)}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/20 p-3 rounded-lg">
                    <p className="text-xs text-white/70 mb-1">Market</p>
                    <p className="font-medium">{ml(p.away_market_ml)}</p>
                    <p className="text-xs text-white/80">{pct(p.away_market_pct)}</p>
                  </div>
                  <div className="bg-black/20 p-3 rounded-lg">
                    <p className="text-xs text-white/70 mb-1">Predicted</p>
                    <p className="font-medium">{ml(p.away_pred_ml)}</p>
                    <p className="text-xs text-white/80">{pct(p.away_pred_pct)}</p>
                  </div>
                </div>
              </div>
              
              {/* Home team section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xl font-bold">{p.home_team}</h4>
                    <p className="text-sm text-white/70">{p.home_pitcher ?? "TBD"}</p>
                  </div>
                  
                  <div className="flex items-center justify-center px-4 py-2 bg-black/20 rounded-lg">
                    <div className="flex items-center gap-1">
                      {p.home_edge_pct && (
                        <>
                          {p.home_edge_pct > 0 ? (
                            <ArrowUp className="w-4 h-4 text-edge-secondary" />
                          ) : (
                            <ArrowDown className="w-4 h-4 text-edge-accent" />
                          )}
                          <span className="font-bold text-lg">
                            {Math.abs(p.home_edge_pct * 100).toFixed(1)}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/20 p-3 rounded-lg">
                    <p className="text-xs text-white/70 mb-1">Market</p>
                    <p className="font-medium">{ml(p.home_market_ml)}</p>
                    <p className="text-xs text-white/80">{pct(p.home_market_pct)}</p>
                  </div>
                  <div className="bg-black/20 p-3 rounded-lg">
                    <p className="text-xs text-white/70 mb-1">Predicted</p>
                    <p className="font-medium">{ml(p.home_pred_ml)}</p>
                    <p className="text-xs text-white/80">{pct(p.home_pred_pct)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AspectRatio>
      </Card>
    );
  }
  
  // Regular card with premium lock overlay if needed
  return (
    <Card className={cn("edge-card relative", p.isFeatured && "border-0 shadow-lg")}>
      {isLocked && (
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-10 rounded-lg">
          <Lock className="h-8 w-8 text-white mb-2" />
          <p className="text-white font-medium">Premium Content</p>
        </div>
      )}
      
      <CardContent className={cn("p-4 space-y-2", p.isFeatured && "bg-transparent", isLocked && "blur-sm")}>
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
