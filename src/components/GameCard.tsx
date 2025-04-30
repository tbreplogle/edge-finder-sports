
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
  
  // Determine if content should be masked (premium protection)
  const shouldMask = predictedMargin === null || 
                     (edge === null) || 
                     (!isAdmin && isPremium && Math.abs(edge || 0) > 2 && !isPaid && !isPreviewGame);
  
  // Check if card is locked (guest/free user)
  const isLocked = (predictedMargin === null || edge === null) && !isPreviewGame;
  
  // Format the market spread for display
  const formattedMarketSpread = marketSpread > 0 
    ? `${homeTeam} -${Math.abs(marketSpread)}` 
    : marketSpread < 0 
      ? `${awayTeam} -${Math.abs(marketSpread)}` 
      : "Pick'em";
  
  return (
    <Card 
      className={cn(
        "edge-card relative focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
        `edge-sport-${sport}`,
        isLocked ? "bg-slate-800/70 border-slate-700 hover:bg-slate-700/70" : "",
        isPreviewGame ? "ring-2 ring-edge-secondary ring-opacity-50" : ""
      )}
      tabIndex={0}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={isLocked ? "text-slate-400" : ""}>
                  {sport.toUpperCase()}
                </Badge>
                {isPreviewGame && (
                  <Badge variant="secondary" className="flex gap-1 items-center">
                    <Star className="w-3 h-3" />
                    <span>Preview</span>
                  </Badge>
                )}
              </div>
              <h3 className={cn("font-bold text-lg", isLocked ? "text-slate-400" : "")}>
                {awayTeam} @ {homeTeam}
              </h3>
              <div className={cn("flex items-center text-sm mt-1", isLocked ? "text-slate-400" : "text-muted-foreground")}>
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
              <div className={cn("text-sm", isLocked ? "text-slate-400" : "text-muted-foreground")}>Market Spread</div>
              <div className={cn("font-medium", isLocked ? "text-slate-400" : "")}>
                {formattedMarketSpread}
              </div>
            </div>
            <div>
              <div className={cn("text-sm", isLocked ? "text-slate-400" : "text-muted-foreground")}>Predicted Margin</div>
              <div className={cn("font-medium", isLocked ? "text-slate-400" : "")}>
                {predictedMargin !== null ? (
                  predictedMargin > 0 
                    ? `${homeTeam} by ${predictedMargin.toFixed(1)}` 
                    : predictedMargin < 0 
                      ? `${awayTeam} by ${Math.abs(predictedMargin).toFixed(1)}` 
                      : "Even"
                ) : (
                  <span className="italic font-medium">Premium</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-2">
            <div className={cn("text-sm", isLocked ? "text-slate-400" : "text-muted-foreground")}>Edge</div>
            <div className={cn(
              "font-bold text-lg flex items-center gap-1.5",
              isLocked ? "text-slate-400" : ""
            )}>
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
                <span className="italic font-medium">Premium</span>
              )}
              
              {confidence && (
                <span className={cn("ml-auto text-sm", isLocked ? "text-slate-400" : "text-muted-foreground")}>
                  {confidence}% confidence
                </span>
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
      
      {/* Locked overlay for premium content */}
      {isLocked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center 
                      backdrop-blur-sm bg-black/30 rounded-lg transition
                      hover:bg-black/15 z-10">
          <LockIcon className="h-6 w-6 text-slate-500 opacity-70 mb-1" />
          <span className="italic text-slate-400 font-medium">Premium</span>
          <Button 
            variant="default" 
            size="sm"
            className="mt-3 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
            onClick={() => window.location.href = '/pricing'}
          >
            Unlock game
          </Button>
        </div>
      )}
    </Card>
  );
}
