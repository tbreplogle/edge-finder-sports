
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
      <path d="M6 11l-5-2c0 5.5 1.8 8.7 5 10l2-5c-2-1-2-3-2-3z" />
      <path d="M18 11l5-2c0 5.5-1.8 8.7-5 10l-2-5c2-1 2-3 2-3z" />
      <path d="M6 11c0 2 1 4 6 4s6-2 6-4" />
      <path d="M12 2a5 5 0 0 0-5 5v4" />
      <path d="M12 2a5 5 0 0 1 5 5v4" />
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
      <path d="M5.95 5.95a7 7 0 1 0 9.9 9.9 7 7 0 0 0-9.9-9.9Z" />
      <path d="m2.9 19.1 2.1-2.1" />
      <path d="m21.1 2.9-2.1 2.1" />
      <path d="m5 12 7 7" />
      <path d="m19 5-7 7" />
    </svg>
  );
}
