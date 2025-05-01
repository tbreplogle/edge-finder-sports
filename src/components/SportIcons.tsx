
import { 
  Timer, 
  GalleryHorizontalEnd, 
  Dumbbell 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IconProps {
  className?: string;
}

export function FootballIcon({ className }: IconProps) {
  return (
    <Timer
      className={cn("w-6 h-6", className)}
    />
  );
}

export function BasketballIcon({ className }: IconProps) {
  return (
    <GalleryHorizontalEnd
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
