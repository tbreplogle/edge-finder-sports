
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";
import { LineMovementTimeline } from "./LineMovementTimeline";
import { useState } from "react";

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
  
  // Skip for MLB
  if (isBaseball) return null;
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="p-1 h-auto flex items-center gap-1 hover:bg-transparent"
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
        <LineMovementTimeline gameId={gameId} homeTeam={homeTeam} awayTeam={awayTeam} />
      </DialogContent>
    </Dialog>
  );
}
