
// src/lib/utils.ts
// -----------------------------------------------------------------------------
// ShadCN‑style class‑name combiner
// -----------------------------------------------------------------------------
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combine Tailwind / conditional class names and dedupe conflicts.
 *
 * Example:
 * ```tsx
 * <button className={cn("px-4 py-2", disabled && "opacity-50")} />
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// -----------------------------------------------------------------------------
// MLB helper
// -----------------------------------------------------------------------------
export function findHighestEdgePrediction<
  T extends { home_edge_pct: number | null; away_edge_pct: number | null }
>(predictions: T[]): T | undefined {
  if (!predictions || predictions.length === 0) return undefined;

  return predictions.reduce((highest, current) => {
    const highestEdge = Math.max(
      Math.abs(highest.home_edge_pct ?? 0),
      Math.abs(highest.away_edge_pct ?? 0),
    );

    const currentEdge = Math.max(
      Math.abs(current.home_edge_pct ?? 0),
      Math.abs(current.away_edge_pct ?? 0),
    );

    return currentEdge > highestEdge ? current : highest;
  }, predictions[0]);
}
