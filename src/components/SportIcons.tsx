
import { FaFootballBall, FaBasketballBall, FaBaseballBall } from "react-icons/fa";
import { cn } from "@/lib/utils";

interface IconProps {
  className?: string;
}

export function FootballIcon({ className }: IconProps) {
  return (
    <FaFootballBall
      className={cn("w-6 h-6", className)}
    />
  );
}

export function BasketballIcon({ className }: IconProps) {
  return (
    <FaBasketballBall
      className={cn("w-6 h-6", className)}
    />
  );
}

export function BaseballIcon({ className }: IconProps) {
  return (
    <FaBaseballBall
      className={cn("w-6 h-6", className)}
    />
  );
}
