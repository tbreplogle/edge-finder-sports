
import { Football, CircleDashed, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

interface IconProps {
  className?: string;
}

export function FootballIcon({ className }: IconProps) {
  return (
    <Football
      className={cn("w-6 h-6", className)}
    />
  );
}

export function BasketballIcon({ className }: IconProps) {
  return (
    <CircleDashed
      className={cn("w-6 h-6", className)}
    />
  );
}

export function BaseballIcon({ className }: IconProps) {
  return (
    <Dumbbell
      className={cn("w-6 h-6", className)}
    />
  );
}
