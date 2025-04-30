
import React from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { TickerDayGroup } from "./TickerDayGroup";
import { TickerData } from "@/utils/types/sports";

interface TickerContentProps {
  data: TickerData;
}

export const TickerContent = ({ data }: TickerContentProps) => {
  return (
    <div className="relative w-full px-0">
      <Carousel 
        opts={{
          align: "start",
          loop: true,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-3">
          {data.days.map((day) => (
            <CarouselItem key={day.date} className="pl-3 md:basis-auto">
              <TickerDayGroup day={day} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="hidden sm:block">
          <CarouselPrevious className="absolute left-0 -translate-x-full top-1/2 -translate-y-1/2 z-10" />
          <CarouselNext className="absolute right-0 translate-x-full top-1/2 -translate-y-1/2 z-10" />
        </div>
      </Carousel>
    </div>
  );
};
