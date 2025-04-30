
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SportTabs } from "@/components/SportTabs";
import { TabsContent } from "@/components/ui/tabs";
import { useState, useMemo, useEffect } from "react";
import { GameCard, GameProps } from "@/components/GameCard";
import { PremiumBanner } from "@/components/PremiumBanner";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sport, setSport] = useState<string>("nfl");
  const [games, setGames] = useState<GameProps[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  
  // Check authentication state
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setIsAuthenticated(!!data.session);
      
      if (!data.session) {
        toast({
          title: "Authentication Required",
          description: "Please login to view the dashboard",
          variant: "default",
        });
        navigate("/auth/login");
      }
    };
    
    checkAuth();
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setIsAuthenticated(!!session);
        if (!session && event === "SIGNED_OUT") {
          navigate("/");
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, toast]);
  
  // Fetch games from the edge function
  useEffect(() => {
    const fetchGames = async () => {
      if (!isAuthenticated) return;
      
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';
        
        const response = await supabase.functions.invoke('get-predictions', {
          body: { sport },
          headers: session ? {
            Authorization: `Bearer ${token}`
          } : {}
        });
        
        if (response.error) {
          throw new Error(response.error);
        }
        
        setGames(response.data.data || []);
      } catch (error) {
        console.error('Error fetching games:', error);
        toast({
          title: "Error",
          description: "Failed to load predictions. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    if (isAuthenticated) {
      fetchGames();
    }
  }, [sport, isAuthenticated, toast]);
  
  const filteredGames = useMemo(() => {
    return games.filter(game => game.sport === sport);
  }, [games, sport]);
  
  // If not authenticated, don't render the dashboard
  if (!isAuthenticated) {
    return null;
  }
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header isAuthenticated={isAuthenticated} />
      
      <main className="flex-1 container py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Live Predictions Dashboard</h1>
            <p className="text-muted-foreground">
              Today's games with predicted margins and market edges
            </p>
          </div>
          
          <Button variant="outline" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>May 1, 2025</span>
          </Button>
        </div>
        
        <SportTabs activeTab={sport} onTabChange={setSport}>
          <TabsContent value="nfl" className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading NFL predictions...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGames.map(game => (
                  <GameCard key={game.id} {...game} />
                ))}
              </div>
            )}
            {!loading && filteredGames.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No NFL games scheduled for today.</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="ncaaf" className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading NCAAF predictions...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGames.map(game => (
                  <GameCard key={game.id} {...game} />
                ))}
              </div>
            )}
            {!loading && filteredGames.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No NCAAF games scheduled for today.</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="ncaab" className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading NCAAB predictions...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGames.map(game => (
                  <GameCard key={game.id} {...game} />
                ))}
              </div>
            )}
            {!loading && filteredGames.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No NCAAB games scheduled for today.</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="mlb" className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading MLB predictions...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGames.map(game => (
                  <GameCard key={game.id} {...game} />
                ))}
              </div>
            )}
            {!loading && filteredGames.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No MLB games scheduled for today.</p>
              </div>
            )}
          </TabsContent>
        </SportTabs>
        
        <PremiumBanner />
        
        <div className="mt-8 p-4 border rounded-lg bg-card">
          <h3 className="font-medium mb-2">Legend</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 bg-edge-nfl rounded-full"></div>
                <span className="text-sm font-medium">NFL</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-edge-ncaaf rounded-full"></div>
                <span className="text-sm font-medium">NCAAF</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 bg-edge-ncaab rounded-full"></div>
                <span className="text-sm font-medium">NCAAB</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-edge-mlb rounded-full"></div>
                <span className="text-sm font-medium">MLB</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <p>Data refreshed every 15 minutes during in-season periods.</p>
              <p>All times displayed in CT (America/Chicago).</p>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Dashboard;
