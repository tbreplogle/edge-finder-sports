
import React from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { TickerDayGroup } from "./TickerDayGroup";
import { TickerData } from "@/utils/types/sports";
import { Info } from "lucide-react";

interface TickerContentProps {
  data: TickerData;
}

export const TickerContent = ({ data }: TickerContentProps) => {
  return (
    <div className="relative w-full px-6">
      <div className="flex items-center text-xs text-muted-foreground mb-2">
        <Info className="h-3 w-3 mr-1" />
        <span>Latest odds and upcoming games across {data.sport.toUpperCase()}</span>
      </div>
      
      <Carousel 
        opts={{
          align: "start",
          loop: true,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2">
          {data.days.map((day) => (
            <CarouselItem key={day.date} className="pl-2 md:basis-auto">
              <TickerDayGroup day={day} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="hidden sm:block">
          <CarouselPrevious className="absolute -left-12 top-1/2 -translate-y-1/2" />
          <CarouselNext className="absolute -right-12 top-1/2 -translate-y-1/2" />
        </div>
      </Carousel>
    </div>
  );
};
