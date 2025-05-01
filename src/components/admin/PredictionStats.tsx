
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tables } from "@/integrations/supabase/types";

interface PredictionStatsProps {
  predictions: Tables<"predictions">[];
}

export function PredictionStats({ predictions }: PredictionStatsProps) {
  const mlbCount = predictions.filter(p => p.sport === "MLB").length;
  const avgEdge = predictions.length > 0 
    ? (predictions.reduce((acc, p) => acc + (p.edge || 0), 0) / predictions.length).toFixed(2)
    : "0.00";
  const latestUpdate = predictions.length > 0
    ? new Date(predictions[0]?.updated_at).toLocaleString()
    : "No data";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Total Predictions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{predictions.length}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">MLB Predictions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{mlbCount}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Avg. Edge</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgEdge}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Latest Update</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm font-bold">{latestUpdate}</div>
        </CardContent>
      </Card>
    </div>
  );
}
