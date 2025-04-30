
import React from "react";
import { Badge } from "@/components/ui/badge";
import { TickerDay } from "@/utils/types/sports";
import { TickerGameItem } from "./TickerGameItem";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface TickerDayGroupProps {
  day: TickerDay;
}

export const TickerDayGroup = ({ day }: TickerDayGroupProps) => {
  return (
    <div className="flex flex-col">
      <div className="flex items-center mb-1">
        <Badge variant="secondary" className="text-xs font-medium bg-edge-neutral text-white border-none mr-2.5 whitespace-nowrap px-3 py-1">
          {day.label}
        </Badge>
        <ScrollArea className="w-full">
          <div className="flex overflow-visible">
            {day.games.length > 0 ? (
              <div className="flex gap-0.5">
                {day.games.map((game) => (
                  <TickerGameItem key={game.id} game={game} />
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic px-2">No games scheduled</span>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
};
