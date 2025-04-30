
import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FootballIcon, BasketballIcon, BaseballIcon } from "../SportIcons";
import { SportKey } from "@/utils/config/sportKeys";

interface SportSelectorProps {
  selectedSport: string;
  onSportChange: (value: string) => void;
}

export const SportSelector = ({ selectedSport, onSportChange }: SportSelectorProps) => {
  const getSportIcon = (sport: string) => {
    switch (sport.toLowerCase()) {
      case 'nfl':
      case 'ncaaf':
        return <FootballIcon className="h-4 w-4 mr-2" />;
      case 'ncaab':
        return <BasketballIcon className="h-4 w-4 mr-2" />;
      case 'mlb':
        return <BaseballIcon className="h-4 w-4 mr-2" />;
      default:
        return <FootballIcon className="h-4 w-4 mr-2" />;
    }
  };

  return (
    <Select value={selectedSport} onValueChange={onSportChange}>
      <SelectTrigger className="w-[130px] h-8">
        <SelectValue>
          <div className="flex items-center">
            {getSportIcon(selectedSport)}
            <span>{selectedSport.toUpperCase()}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="NFL" className="flex items-center">
          <div className="flex items-center">
            <FootballIcon className="h-4 w-4 mr-2" />
            <span>NFL</span>
          </div>
        </SelectItem>
        <SelectItem value="NCAAF" className="flex items-center">
          <div className="flex items-center">
            <FootballIcon className="h-4 w-4 mr-2" />
            <span>NCAAF</span>
          </div>
        </SelectItem>
        <SelectItem value="NCAAB" className="flex items-center">
          <div className="flex items-center">
            <BasketballIcon className="h-4 w-4 mr-2" />
            <span>NCAAB</span>
          </div>
        </SelectItem>
        <SelectItem value="MLB" className="flex items-center">
          <div className="flex items-center">
            <BaseballIcon className="h-4 w-4 mr-2" />
            <span>MLB</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
};
