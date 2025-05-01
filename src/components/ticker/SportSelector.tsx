
import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SPORT_ICON_MAP } from "@/components/SportIcons";
import { IconContext } from "react-icons";
import { SportKey } from "@/utils/config/sportKeys";

interface SportSelectorProps {
  selectedSport: string;
  onSportChange: (value: string) => void;
}

export const SportSelector = ({ selectedSport, onSportChange }: SportSelectorProps) => {
  const getSportIcon = (sport: string) => {
    return SPORT_ICON_MAP[sport.toUpperCase()] || SPORT_ICON_MAP.NFL;
  };

  return (
    <IconContext.Provider value={{ size: '1rem', className: 'inline-block mr-2' }}>
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
              {SPORT_ICON_MAP.NFL}
              <span>NFL</span>
            </div>
          </SelectItem>
          <SelectItem value="NCAAF" className="flex items-center">
            <div className="flex items-center">
              {SPORT_ICON_MAP.NCAAF}
              <span>NCAAF</span>
            </div>
          </SelectItem>
          <SelectItem value="NCAAB" className="flex items-center">
            <div className="flex items-center">
              {SPORT_ICON_MAP.NCAAB}
              <span>NCAAB</span>
            </div>
          </SelectItem>
          <SelectItem value="MLB" className="flex items-center">
            <div className="flex items-center">
              {SPORT_ICON_MAP.MLB}
              <span>MLB</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </IconContext.Provider>
  );
};
