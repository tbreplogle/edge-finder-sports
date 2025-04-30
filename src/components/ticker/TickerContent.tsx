
import React from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { TickerGameItem } from "./TickerGameItem";
import { TickerGame } from "@/utils/types/sports";

interface TickerContentProps {
  games: TickerGame[];
}

export const TickerContent = ({ games }: TickerContentProps) => {
  return (
    <div className="relative w-full px-0">
      <Carousel 
        opts={{
          align: "start",
          loop: true,
          slidesToScroll: 1, // Ensure we scroll 1 item at a time
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-3">
          {games.length > 0 ? (
            games.map((game) => (
              <CarouselItem key={game.id} className="pl-3 basis-auto max-w-fit">
                <TickerGameItem game={game} />
              </CarouselItem>
            ))
          ) : (
            <CarouselItem className="pl-3 basis-full">
              <div className="flex items-center justify-center p-4 bg-edge-primary/50
                          border border-edge-neutral/30 text-white">
                <p className="text-sm">No games scheduled</p>
              </div>
            </CarouselItem>
          )}
        </CarouselContent>
        {games.length > 0 && (
          <>
            <CarouselPrevious className="absolute -left-4 lg:-left-12 top-1/2 -translate-y-1/2" />
            <CarouselNext className="absolute -right-4 lg:-right-12 top-1/2 -translate-y-1/2" />
          </>
        )}
      </Carousel>
    </div>
  );
};
