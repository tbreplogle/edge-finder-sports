
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Clock, LockIcon, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";

export interface GameProps {
  id: string;
  sport: "nfl" | "ncaaf" | "ncaab" | "mlb";
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  marketSpread: number;
  predictedMargin: number | null;
  edge: number | null;
  confidence?: number | null;
  isPremium?: boolean;
  rawFactors?: Record<string, any> | null;
  isPreviewGame?: boolean;
  isPreview?: boolean;
}

export function GameCard({
  id,
  sport,
  homeTeam,
  awayTeam,
  startTime,
  marketSpread,
  predictedMargin,
  edge,
  confidence,
  isPremium = false,
  rawFactors,
  isPreviewGame = false,
  isPreview = false
}: GameProps) {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  
  const formattedDate = new Date(startTime).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago'
  });
  
  // Check if user is admin or paid
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setIsAdmin(user.is_admin === true);
        setIsPaid(user.role === "premium" || user.is_admin === true);
      } catch (e) {
        console.error("Error parsing user data:", e);
      }
    }
  }, []);
  
  const isPositiveEdge = edge !== null && edge > 0;
  
  // Admin users see all data unblurred regardless of premium status
  // Paid users see all data except extremely high value edges that are premium
  // Free users see basic edges but premium edges are blurred
  // Preview games are always shown with full data
  const shouldMask = predictedMargin === null || 
                     (edge === null) || 
                     (!isAdmin && isPremium && Math.abs(edge || 0) > 2 && !isPaid && !isPreviewGame);
  
  // Format the market spread for display
  const formattedMarketSpread = marketSpread > 0 
    ? `${homeTeam} -${Math.abs(marketSpread)}` 
    : marketSpread < 0 
      ? `${awayTeam} -${Math.abs(marketSpread)}` 
      : "Pick'em";
  
  return (
    <Card className={cn(
      "edge-card", 
      `edge-sport-${sport}`,
      isPreviewGame && "ring-2 ring-edge-secondary ring-opacity-50"
    )}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">
                  {sport.toUpperCase()}
                </Badge>
                {isPreviewGame && (
                  <Badge variant="secondary" className="flex gap-1 items-center">
                    <Star className="w-3 h-3" />
                    <span>Preview</span>
                  </Badge>
                )}
              </div>
              <h3 className="font-bold text-lg">{awayTeam} @ {homeTeam}</h3>
              <div className="flex items-center text-sm text-muted-foreground mt-1">
                <Clock className="w-3 h-3 mr-1" />
                <span>{formattedDate}</span>
              </div>
            </div>
            
            {!isAdmin && isPremium && Math.abs(edge || 0) > 2 && !isPaid && !isPreviewGame && (
              <Badge variant="secondary" className="flex gap-1 items-center">
                <LockIcon className="w-3 h-3" />
                <span>Premium</span>
              </Badge>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <div className="text-sm text-muted-foreground">Market Spread</div>
              <div className="font-medium">{formattedMarketSpread}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Predicted Margin</div>
              <div className={cn("font-medium premium-content-wrapper", shouldMask ? "relative" : "")}>
                {/* Content is always visible, but may be masked */}
                <span>
                  {predictedMargin !== null ? (
                    predictedMargin > 0 
                      ? `${homeTeam} by ${predictedMargin.toFixed(1)}` 
                      : predictedMargin < 0 
                        ? `${awayTeam} by ${Math.abs(predictedMargin).toFixed(1)}` 
                        : "Even"
                  ) : (
                    "Not available"
                  )}
                </span>
                
                {/* Overlay mask for premium content */}
                {shouldMask && !isPreviewGame && predictedMargin === null && (
                  <div className="premium-mask">
                    <LockIcon className="w-4 h-4 mr-1" />
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-2">
            <div className="text-sm text-muted-foreground mb-1">Edge</div>
            <div className={cn(
              "font-bold text-lg flex items-center gap-1.5 premium-content-wrapper",
              shouldMask ? "relative" : ""
            )}>
              {/* Content is always visible, but may be masked */}
              {edge !== null ? (
                <>
                  {isPositiveEdge ? (
                    <>
                      <ArrowUp className="w-4 h-4 text-edge-secondary" />
                      <span className="text-edge-secondary">
                        {edge.toFixed(1)} pts
                      </span>
                    </>
                  ) : (
                    <>
                      <ArrowDown className="w-4 h-4 text-edge-accent" />
                      <span className="text-edge-accent">
                        {edge.toFixed(1)} pts
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span>Not available</span>
              )}
              
              {confidence && (
                <span className="ml-auto text-sm text-muted-foreground">
                  {confidence}% confidence
                </span>
              )}
              
              {/* Overlay mask for premium content */}
              {shouldMask && !isPreviewGame && edge === null && (
                <div className="premium-mask">
                  <div className="flex items-center">
                    <LockIcon className="w-4 h-4 mr-1" />
                    <span className="text-sm">2.0+ pts</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {rawFactors && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={cn(
                    "mt-3 w-full", 
                    !isAdmin && !isPaid && isPremium && !isPreviewGame && "opacity-70"
                  )}
                  disabled={!isAdmin && !isPaid && isPremium && !isPreviewGame}
                >
                  {!isAdmin && !isPaid && isPremium && !isPreviewGame ? "Upgrade to view details" : "View details"}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{awayTeam} @ {homeTeam} - Raw Factors</DialogTitle>
                </DialogHeader>
                <div className="mt-4 bg-muted p-4 rounded-md text-sm overflow-auto max-h-[400px]">
                  <pre>{JSON.stringify(rawFactors, null, 2)}</pre>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
