
import React from "react";
import { CircleDollarSign } from "lucide-react";

interface LogoProps {
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ showText = true, size = "md" }: LogoProps) {
  // Define size classes
  const sizeClasses = {
    sm: "h-6",
    md: "h-7",
    lg: "h-8"
  };
  
  const iconSize = {
    sm: 18,
    md: 22,
    lg: 24
  };
  
  return (
    <div className="flex items-center">
      <div className="relative flex items-center justify-center mr-2">
        <div className="absolute inset-0 bg-edge-secondary/20 rounded-full animate-pulse" />
        <div className="relative z-10 bg-edge-secondary text-white p-1 rounded-full">
          <CircleDollarSign size={iconSize[size]} strokeWidth={2} />
        </div>
      </div>
      
      {showText && (
        <div className="flex items-baseline">
          <span className="font-bold text-edge-secondary tracking-tight">
            <span className={`${sizeClasses[size]} hidden md:inline`}>Game</span>
            <span className={sizeClasses[size]}>Intel</span>
          </span>
        </div>
      )}
    </div>
  );
}
