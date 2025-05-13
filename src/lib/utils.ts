
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { ProcessedMlbPrediction } from "@/utils/fetchMlbPredictions"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function findHighestEdgePrediction(predictions: ProcessedMlbPrediction[]): ProcessedMlbPrediction | null {
  if (!predictions || predictions.length === 0) {
    return null;
  }
  
  return [...predictions].sort((a, b) => {
    const edgeA = Math.max(
      Math.abs(a.home_edge_pct ?? 0),
      Math.abs(a.away_edge_pct ?? 0)
    );
    const edgeB = Math.max(
      Math.abs(b.home_edge_pct ?? 0),
      Math.abs(b.away_edge_pct ?? 0)
    );
    return edgeB - edgeA;
  })[0];
}
