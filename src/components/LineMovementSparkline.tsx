
import { useEffect, useState } from "react";
import { Line, LineChart } from "recharts";
import { supabase } from "@/integrations/supabase/client";

interface LineMovementSparklineProps {
  gameId: string;
  isBaseball?: boolean;
  className?: string;
}

export function LineMovementSparkline({ 
  gameId, 
  isBaseball = false,
  className = ""
}: LineMovementSparklineProps) {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Skip for MLB - they use moneyline odds instead of spreads
    if (isBaseball) {
      setIsLoading(false);
      return;
    }
    
    const fetchLineMovements = async () => {
      try {
        setIsLoading(true);
        
        const { data, error } = await supabase.functions.invoke('get-line-movements', {
          body: { gameId }
        });
        
        if (error) {
          console.error('Error fetching line movements:', error);
          return;
        }
        
        if (data?.movements && Array.isArray(data.movements) && data.movements.length > 0) {
          const formattedData = data.movements.map((move: any) => ({
            ts: new Date(move.ts).getTime(),
            value: move.spread_home
          }));
          
          setData(formattedData);
        }
      } catch (error) {
        console.error('Error in line movements fetch:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLineMovements();
  }, [gameId, isBaseball]);
  
  if (isLoading || data.length < 2 || isBaseball) {
    return null;
  }
  
  return (
    <div className={className}>
      <LineChart width={90} height={24} data={data}>
        <Line 
          type="monotone" 
          dataKey="value" 
          dot={false} 
          strokeWidth={2}
          stroke="#94a3b8" 
        />
      </LineChart>
    </div>
  );
}
