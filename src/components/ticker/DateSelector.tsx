
import React from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface DateSelectorProps {
  selectedDate: string;
  availableDates: string[];
  onDateChange: (value: string) => void;
}

export const DateSelector = ({ selectedDate, availableDates, onDateChange }: DateSelectorProps) => {
  return (
    <ToggleGroup 
      type="single" 
      value={selectedDate} 
      onValueChange={(value) => value && onDateChange(value)}
      className="bg-edge-neutral/20 rounded-md p-0.5"
    >
      {availableDates.map((date) => (
        <ToggleGroupItem 
          key={date}
          value={date} 
          className="text-xs font-medium px-3 py-1 data-[state=on]:bg-edge-primary data-[state=on]:text-white"
        >
          {date}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
};
