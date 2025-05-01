
import { useState, useEffect } from "react";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatInTimeZone } from "date-fns-tz";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface LineMovementTimelineProps {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  onLoadComplete?: () => void;
}

export function LineMovementTimeline({ 
  gameId, 
  homeTeam, 
  awayTeam,
  onLoadComplete
}: LineMovementTimelineProps) {
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLineMovements = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const { data: response, error } = await supabase.functions.invoke('get-line-movements', {
          body: { gameId }
        });
        
        if (error) {
          console.error('Error fetching line movements:', error);
          setError('Could not load line movement data');
          return;
        }
        
        if (response?.movements && Array.isArray(response.movements) && response.movements.length > 0) {
          // Format the timestamps for display
          const formattedData = response.movements.map((move: any) => ({
            ...move,
            formattedTs: formatInTimeZone(
              new Date(move.ts),
              'America/Chicago',
              'MM/dd HH:mm'
            ),
          }));
          
          setData(formattedData);
          
          // Set summary data
          if (response.summary) {
            setSummary(response.summary);
          }
        } else {
          setData([]);
        }
      } catch (error) {
        console.error('Error in line movements fetch:', error);
        setError('Failed to load movement data');
      } finally {
        setIsLoading(false);
        if (onLoadComplete) onLoadComplete();
      }
    };
    
    fetchLineMovements();
  }, [gameId, onLoadComplete]);
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading movement data...</span>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-4 text-red-500">{error}</div>;
  }
  
  if (data.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <p>Not enough line movement data available for this game.</p>
        <p className="text-sm mt-2">Our system is collecting data continuously.</p>
      </div>
    );
  }
  
  // Formatter for the tooltip
  const tooltipFormatter = (value: number, name: string) => {
    if (name === 'spread_home') {
      return [`${value > 0 ? '+' : ''}${value}`, 'Home Spread'];
    }
    return [value, name];
  };
  
  // Calculate total movement
  const totalMovement = summary ? summary.delta_spread : 0;
  const movementClass = totalMovement >= 0 
    ? (totalMovement >= 1.5 ? "text-edge-secondary" : "text-foreground") 
    : (totalMovement <= -1.5 ? "text-edge-accent" : "text-foreground");

  return (
    <div className="space-y-4">
      {summary && (
        <div className="flex flex-col items-center justify-center mb-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">Open: {summary.open_spread > 0 ? '+' : ''}{summary.open_spread}</span>
            <span className="text-sm">→</span>
            <span className="text-sm">Current: {summary.curr_spread > 0 ? '+' : ''}{summary.curr_spread}</span>
          </div>
          <Badge className={`${movementClass} bg-background border border-current hover:bg-background/80`}>
            Movement: {totalMovement > 0 ? '+' : ''}{totalMovement.toFixed(1)} pts
          </Badge>
        </div>
      )}
      
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 25, left: 0 }}>
          <XAxis 
            dataKey="formattedTs" 
            angle={-45}
            textAnchor="end"
            height={50}
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            domain={['dataMin - 2', 'dataMax + 2']}
            tick={{ fontSize: 12 }}
          />
          <Tooltip formatter={tooltipFormatter} />
          <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
          <Line 
            type="monotone" 
            dataKey="spread_home" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={true}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
      
      {summary && (
        <div className="text-sm mt-4">
          <p>Total: {summary.open_total} → {summary.curr_total} ({summary.delta_total > 0 ? '+' : ''}{summary.delta_total})</p>
        </div>
      )}
    </div>
  );
}
