
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Activity, Loader2 } from "lucide-react";
import { LineMovementTimeline } from "./LineMovementTimeline";
import { useState } from "react";
import { toast } from "sonner";

interface LineMovementModalProps {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  isBaseball?: boolean;
}

export function LineMovementModal({
  gameId,
  homeTeam,
  awayTeam,
  isBaseball = false
}: LineMovementModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Skip for MLB since they use moneyline rather than spreads
  if (isBaseball) return null;
  
  const handleOpen = (newOpen: boolean) => {
    if (newOpen) {
      setLoading(true);
      // Loading will be handled by the LineMovementTimeline component
    }
    setOpen(newOpen);
  };
  
  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="p-1 h-auto flex items-center gap-1 hover:bg-transparent"
          title="View line movement history"
        >
          <Activity className="h-4 w-4 text-edge-secondary hover:opacity-75" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] md:max-w-[650px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-edge-secondary" />
            <span>{awayTeam} @ {homeTeam} Line Movements</span>
          </DialogTitle>
        </DialogHeader>
        <LineMovementTimeline 
          gameId={gameId} 
          homeTeam={homeTeam} 
          awayTeam={awayTeam} 
          onLoadComplete={() => setLoading(false)} 
        />
        {loading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
