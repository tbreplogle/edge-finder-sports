
import React from "react";
import { Badge } from "@/components/ui/badge";
import { TickerDay } from "@/utils/types/sports";
import { TickerGameItem } from "./TickerGameItem";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TickerDayGroupProps {
  day: TickerDay;
}

export const TickerDayGroup = ({ day }: TickerDayGroupProps) => {
  const isMobile = useIsMobile();
  
  return (
    <div className="flex flex-col">
      <div className="flex items-center mb-1">
        <Badge variant="secondary" className="text-xs mr-2">{day.label}</Badge>
        <ScrollArea className="w-full px-1" orientation="horizontal">
          <div className="flex gap-2 py-1">
            {!isMobile && day.games.map((game) => (
              <TickerGameItem key={game.id} game={game} />
            ))}
            {isMobile && day.games.slice(0, 2).map((game) => (
              <TickerGameItem key={game.id} game={game} />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
