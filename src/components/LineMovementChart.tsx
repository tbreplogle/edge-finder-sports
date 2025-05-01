
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LineMovementTimeline } from "@/components/LineMovementTimeline";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function LineMovementChart() {
  const [topGames, setTopGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTopMovingGames = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const { data: response, error } = await supabase.functions.invoke('get-line-movements', {
          body: { topMovers: true }
        });
        
        if (error) {
          console.error('Error fetching top moving games:', error);
          setError('Failed to fetch line movement data. Please try again later.');
          toast.error('Failed to load line movement data');
          return;
        }
        
        if (response?.topMovers && Array.isArray(response.topMovers)) {
          setTopGames(response.topMovers);
          // Select the first game by default
          if (response.topMovers.length > 0) {
            setSelectedGameId(response.topMovers[0].game_id);
          }
        } else {
          console.log('No top movers returned from API:', response);
          setTopGames([]);
        }
      } catch (error) {
        console.error('Error fetching top movers:', error);
        setError('An unexpected error occurred. Please try again later.');
        toast.error('Failed to load line movement data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTopMovingGames();
  }, []);
  
  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading line movement data...</span>
      </div>
    );
  }
  
  if (error) {
    return <div className="text-center py-4 text-red-500">{error}</div>;
  }
  
  if (topGames.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No significant line movements detected recently.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Check back later as our system continuously monitors odds across major sportsbooks.
        </p>
      </div>
    );
  }
  
  const selectedGame = topGames.find(game => game.game_id === selectedGameId);
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {topGames.map(game => (
          <Card 
            key={game.game_id}
            className={`cursor-pointer hover:border-primary transition-colors ${
              selectedGameId === game.game_id ? 'border-primary ring-1 ring-primary' : ''
            }`}
            onClick={() => setSelectedGameId(game.game_id)}
          >
            <CardContent className="p-4">
              <div className="text-sm font-medium">{game.away_team} @ {game.home_team}</div>
              <div className="text-xs text-muted-foreground">Movement: {game.delta_spread > 0 ? '+' : ''}{game.delta_spread?.toFixed(1) || '0.0'} pts</div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {selectedGame && (
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4">{selectedGame.away_team} @ {selectedGame.home_team} Line Movement</h3>
          <LineMovementTimeline 
            gameId={selectedGame.game_id} 
            homeTeam={selectedGame.home_team} 
            awayTeam={selectedGame.away_team} 
          />
        </div>
      )}
    </div>
  );
}
