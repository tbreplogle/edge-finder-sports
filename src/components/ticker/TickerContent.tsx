
import React from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { TickerDayGroup } from "./TickerDayGroup";
import { TickerData } from "@/utils/types/sports";

interface TickerContentProps {
  data: TickerData;
}

export const TickerContent = ({ data }: TickerContentProps) => {
  // Sort days to ensure Today comes before Tomorrow
  const sortedDays = [...data.days].sort((a, b) => {
    if (a.label === 'Today') return -1;
    if (b.label === 'Today') return 1;
    if (a.label === 'Tomorrow') return 1;
    if (b.label === 'Tomorrow') return -1;
    return 0;
  });

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
          {sortedDays.map((day) => (
            <CarouselItem key={day.date} className="pl-3 md:basis-full lg:basis-full">
              <TickerDayGroup day={day} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="absolute -left-4 lg:-left-12 top-1/2 -translate-y-1/2" />
        <CarouselNext className="absolute -right-4 lg:-right-12 top-1/2 -translate-y-1/2" />
      </Carousel>
    </div>
  );
};
