
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LineMovementTimeline } from "./LineMovementTimeline";
import { LineMovementSparkline } from "./LineMovementSparkline";
import { Button } from "@/components/ui/button";
import { formatInTimeZone } from "date-fns-tz";

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
          <LineMovementSparkline gameId={gameId} className="hover:opacity-75" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Line Movement: {awayTeam} @ {homeTeam}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <LineMovementTimeline gameId={gameId} homeTeam={homeTeam} awayTeam={awayTeam} />
          <div className="text-xs text-muted-foreground mt-2 text-center">
            Times displayed in CT (America/Chicago)
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
