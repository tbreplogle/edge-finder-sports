
import React from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { TickerDayGroup } from "./TickerDayGroup";
import { TickerData } from "@/utils/types/sports";
import { Info } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface TickerContentProps {
  data: TickerData;
}

export const TickerContent = ({ data }: TickerContentProps) => {
  return (
    <div className="relative w-full px-4 md:px-8">
      <div className="flex items-center text-xs text-muted-foreground mb-3">
        <Info className="h-3.5 w-3.5 mr-1.5" />
        <span>Latest odds and upcoming games for {data.sport.toUpperCase()}</span>
      </div>
      
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
          <CarouselPrevious className="absolute -left-14 top-1/2 -translate-y-1/2" />
          <CarouselNext className="absolute -right-14 top-1/2 -translate-y-1/2" />
        </div>
      </Carousel>
    </div>
  );
};
