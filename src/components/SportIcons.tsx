
import { Rugby, Basketball, Baseball } from "lucide-react";
import { cn } from "@/lib/utils";

interface IconProps {
  className?: string;
}

export function FootballIcon({ className }: IconProps) {
  return (
    <Rugby
      className={cn("w-6 h-6", className)}
    />
  );
}

export function BasketballIcon({ className }: IconProps) {
  return (
    <Basketball
      className={cn("w-6 h-6", className)}
    />
  );
}

export function BaseballIcon({ className }: IconProps) {
  return (
    <Baseball
      className={cn("w-6 h-6", className)}
    />
  );
}
