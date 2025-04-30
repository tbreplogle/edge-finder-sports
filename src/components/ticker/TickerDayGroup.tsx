
import React from "react";
import { Badge } from "@/components/ui/badge";
import { TickerDay } from "@/utils/types/sports";
import { TickerGameItem } from "./TickerGameItem";
import { useIsMobile } from "@/hooks/use-mobile";

interface TickerDayGroupProps {
  day: TickerDay;
}

export const TickerDayGroup = ({ day }: TickerDayGroupProps) => {
  const isMobile = useIsMobile();
  
  return (
    <div className="flex flex-col">
      <div className="flex gap-2 items-center mb-1">
        <Badge variant="secondary" className="text-xs">{day.label}</Badge>
        <div className="flex gap-2">
          {!isMobile && day.games.slice(0, 3).map((game) => (
            <TickerGameItem key={game.id} game={game} />
          ))}
          {isMobile && day.games.slice(0, 1).map((game) => (
            <TickerGameItem key={game.id} game={game} />
          ))}
        </div>
      </div>
    </div>
  );
};
