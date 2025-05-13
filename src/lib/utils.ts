// Find the prediction with the highest absolute edge value
export function findHighestEdgePrediction<T extends { home_edge_pct: number | null; away_edge_pct: number | null }>(
  predictions: T[]
): T | undefined {
  if (!predictions || predictions.length === 0) return undefined;
  
  return predictions.reduce((highest, current) => {
    const highestEdge = Math.max(
      Math.abs(highest.home_edge_pct || 0),
      Math.abs(highest.away_edge_pct || 0)
    );
    
    const currentEdge = Math.max(
      Math.abs(current.home_edge_pct || 0),
      Math.abs(current.away_edge_pct || 0)
    );
    
    return currentEdge > highestEdge ? current : highest;
  }, predictions[0]);
}
