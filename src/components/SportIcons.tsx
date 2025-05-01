
import { 
  Shirt, 
  CircleDashed, 
  Swords 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IconProps {
  className?: string;
}

export function FootballIcon({ className }: IconProps) {
  return (
    <Shirt
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
    <Swords
      className={cn("w-6 h-6", className)}
    />
  );
}
