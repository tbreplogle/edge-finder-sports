
import React from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { TickerDayGroup } from "./TickerDayGroup";
import { TickerData } from "@/utils/types/sports";

interface TickerContentProps {
  data: TickerData;
}

export const TickerContent = ({ data }: TickerContentProps) => {
  return (
    <Carousel 
      opts={{
        align: "start",
        loop: true,
      }}
      className="w-full relative"
    >
      <CarouselContent className="-ml-2">
        {data.days.map((day) => (
          <CarouselItem key={day.date} className="pl-2 md:basis-auto">
            <TickerDayGroup day={day} />
          </CarouselItem>
        ))}
      </CarouselContent>
      <div className="hidden sm:block">
        <CarouselPrevious className="absolute -left-4 top-1/2 -translate-y-1/2" />
        <CarouselNext className="absolute -right-4 top-1/2 -translate-y-1/2" />
      </div>
    </Carousel>
  );
};
