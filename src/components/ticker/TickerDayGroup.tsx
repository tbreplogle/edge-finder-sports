
import React from "react";
import { Badge } from "@/components/ui/badge";
import { TickerDay } from "@/utils/types/sports";
import { TickerGameItem } from "./TickerGameItem";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

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
        
        {day.games.length > 0 ? (
          <Carousel
            opts={{
              align: "start",
              loop: true,
              slidesToScroll: 1,
            }}
            className="w-full"
          >
            <CarouselContent>
              {day.games.map((game) => (
                <CarouselItem key={game.id} className="basis-auto max-w-fit pl-0.5 pr-0">
                  <TickerGameItem game={game} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="absolute -left-4 size-6 translate-y-0" />
            <CarouselNext className="absolute -right-4 size-6 translate-y-0" />
          </Carousel>
        ) : (
          <span className="text-xs text-muted-foreground italic px-2">No games scheduled</span>
        )}
      </div>
    </div>
  );
};
