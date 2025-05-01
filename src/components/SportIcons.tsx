
import { FaFootballBall, FaBasketballBall, FaBaseballBall } from "react-icons/fa";
import { cn } from "@/lib/utils";
import { IconContext } from "react-icons";

// Define the sport key type
export type SportIconType = "nfl" | "ncaaf" | "ncaab" | "mlb";

interface IconProps {
  className?: string;
  size?: string;
}

// Create a mapping of sport keys to icons
export const SPORT_ICONS = {
  nfl: FaFootballBall,
  ncaaf: FaFootballBall,
  ncaab: FaBasketballBall,
  mlb: FaBaseballBall
};

// Create a mapping of uppercase sport keys to icons (for selector dropdown)
export const SPORT_ICON_MAP: Record<string, JSX.Element> = {
  NFL: <FaFootballBall />,
  NCAAF: <FaFootballBall />,
  NCAAB: <FaBasketballBall />,
  MLB: <FaBaseballBall />
};

export function SportIcon({ sport, className, size = "1rem" }: { sport: SportIconType } & IconProps) {
  const IconComponent = SPORT_ICONS[sport];
  
  return (
    <IconContext.Provider value={{ size, className: cn("inline-block", className) }}>
      <IconComponent />
    </IconContext.Provider>
  );
}

// Individual icon components for backward compatibility
export function FootballIcon({ className, size = "1rem" }: IconProps) {
  return (
    <IconContext.Provider value={{ size, className: cn("inline-block", className) }}>
      <FaFootballBall />
    </IconContext.Provider>
  );
}

export function BasketballIcon({ className, size = "1rem" }: IconProps) {
  return (
    <IconContext.Provider value={{ size, className: cn("inline-block", className) }}>
      <FaBasketballBall />
    </IconContext.Provider>
  );
}

export function BaseballIcon({ className, size = "1rem" }: IconProps) {
  return (
    <IconContext.Provider value={{ size, className: cn("inline-block", className) }}>
      <FaBaseballBall />
    </IconContext.Provider>
  );
}
