
import { cn } from "@/lib/utils";

interface IconProps {
  className?: string;
}

export function FootballIcon({ className }: IconProps) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={cn("w-6 h-6", className)}
    >
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2Z" />
      <path d="M15 9.4v5.2" />
      <path d="m12 12 5.2 3" />
      <path d="M12 12 9 6.8" />
      <path d="M12 12 6.8 9" />
      <path d="m12 12-3 5.2" />
    </svg>
  );
}

export function BasketballIcon({ className }: IconProps) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={cn("w-6 h-6", className)}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M4.93 4.93a19.84 19.84 0 0 1 14.14 0" />
      <path d="M4.93 19.07a19.84 19.84 0 0 0 14.14 0" />
      <path d="M12 2a12 12 0 0 0 0 20" />
      <path d="M12 2a12 12 0 0 1 0 20" />
    </svg>
  );
}

export function BaseballIcon({ className }: IconProps) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={cn("w-6 h-6", className)}
    >
      <path d="M12 2a1 1 0 1 0 0 2 8 8 0 1 1 0 16 1 1 0 1 0 0 2 10 10 0 1 0 0-20Z" />
      <path d="M12 4v16" />
      <path d="M15 6.5a9 9 0 0 1 0 11" />
      <path d="M9 6.5a9 9 0 0 0 0 11" />
      <path d="M5.36 10a9 9 0 0 0 0 4" />
      <path d="M18.64 10a9 9 0 0 1 0 4" />
    </svg>
  );
}
