
import React from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { TickerGameItem } from "./TickerGameItem";
import { TickerGame } from "@/utils/types/sports";

interface TickerContentProps {
  games: TickerGame[];
}

export const TickerContent = ({ games }: TickerContentProps) => {
  return (
    <div className="relative w-full">
      <Carousel 
        opts={{
          align: "start",
          loop: true,
          slidesToScroll: 1,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2 sm:-ml-3">
          {games.length > 0 ? (
            games.map((game) => (
              <CarouselItem key={game.id} className="pl-2 sm:pl-3 basis-auto max-w-fit">
                <TickerGameItem game={game} />
              </CarouselItem>
            ))
          ) : (
            <CarouselItem className="pl-2 sm:pl-3 basis-full">
              <div className="flex items-center justify-center p-3 sm:p-4 bg-edge-primary/50
                          border border-edge-neutral/30 text-white rounded-md">
                <p className="text-xs sm:text-sm">No games scheduled</p>
              </div>
            </CarouselItem>
          )}
        </CarouselContent>
        {games.length > 0 && (
          <>
            <CarouselPrevious className="absolute -left-8 lg:-left-10 xl:-left-12 top-1/2 -translate-y-1/2 h-7 w-7 sm:h-8 sm:w-8" />
            <CarouselNext className="absolute -right-8 lg:-right-10 xl:-right-12 top-1/2 -translate-y-1/2 h-7 w-7 sm:h-8 sm:w-8" />
          </>
        )}
      </Carousel>
    </div>
  );
}
