
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
      <div className="flex flex-wrap gap-2 items-center mb-1">
        <Badge variant="secondary" className="text-xs">{day.label}</Badge>
        <div className="flex flex-wrap gap-2">
          {/* Show all games instead of limiting to 3 */}
          {!isMobile && day.games.map((game) => (
            <TickerGameItem key={game.id} game={game} />
          ))}
          {/* On mobile, still limit to 2 games to prevent overflow */}
          {isMobile && day.games.slice(0, 2).map((game) => (
            <TickerGameItem key={game.id} game={game} />
          ))}
        </div>
      </div>
    </div>
  );
};
