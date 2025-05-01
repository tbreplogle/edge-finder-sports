
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Activity } from "lucide-react";

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
  // Skip for MLB
  if (isBaseball) return null;
  
  return (
    <Link to="/line-tracker">
      <Button 
        variant="ghost" 
        size="sm" 
        className="p-1 h-auto flex items-center gap-1 hover:bg-transparent"
      >
        <Activity className="h-4 w-4 text-edge-secondary hover:opacity-75" />
      </Button>
    </Link>
  );
}
