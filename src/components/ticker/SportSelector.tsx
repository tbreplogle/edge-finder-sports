
import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FaFootballBall, FaBasketballBall, FaBaseballBall } from "react-icons/fa";
import { IconContext } from "react-icons";
import { SportKey } from "@/utils/config/sportKeys";

interface SportSelectorProps {
  selectedSport: string;
  onSportChange: (value: string) => void;
}

export const SportSelector = ({ selectedSport, onSportChange }: SportSelectorProps) => {
  const SPORT_ICON: Record<string, JSX.Element> = {
    NFL: <FaFootballBall />,
    NCAAF: <FaFootballBall />,
    NCAAB: <FaBasketballBall />,
    MLB: <FaBaseballBall />
  };

  const getSportIcon = (sport: string) => {
    return SPORT_ICON[sport.toUpperCase()] || <FaFootballBall />;
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
              {SPORT_ICON.NFL}
              <span>NFL</span>
            </div>
          </SelectItem>
          <SelectItem value="NCAAF" className="flex items-center">
            <div className="flex items-center">
              {SPORT_ICON.NCAAF}
              <span>NCAAF</span>
            </div>
          </SelectItem>
          <SelectItem value="NCAAB" className="flex items-center">
            <div className="flex items-center">
              {SPORT_ICON.NCAAB}
              <span>NCAAB</span>
            </div>
          </SelectItem>
          <SelectItem value="MLB" className="flex items-center">
            <div className="flex items-center">
              {SPORT_ICON.MLB}
              <span>MLB</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </IconContext.Provider>
  );
};
