
import { AppLayout } from "@/components/AppLayout";
import { SportTabs } from "@/components/SportTabs";
import { TabsContent } from "@/components/ui/tabs";
import { useState, useMemo, useEffect } from "react";
import { GameCard, GameProps } from "@/components/GameCard";
import { PremiumBanner } from "@/components/PremiumBanner";
import { Button } from "@/components/ui/button";
import { Calendar, Info, RefreshCw, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { format, addDays, setHours, setMinutes, setSeconds, isBefore } from "date-fns";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sport, setSport] = useState<string>("nfl");
  const [games, setGames] = useState<GameProps[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string | null>("guest");
  const [generatedDate, setGeneratedDate] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [refreshTime, setRefreshTime] = useState<string | null>("08:00 AM CT");
  const [nextRefreshDate, setNextRefreshDate] = useState<string | null>(null);
  
  // Calculate next Tuesday at 8:00 AM CT
  useEffect(() => {
    const calculateNextTuesday = () => {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday, 2 is Tuesday, etc.
      
      // Calculate days until next Tuesday (2)
      const daysUntilNextTuesday = (dayOfWeek <= 2) ? (2 - dayOfWeek) : (9 - dayOfWeek);
      
      // Set next Tuesday at 8:00 AM CT
      let nextTuesday = addDays(now, daysUntilNextTuesday);
      nextTuesday = setHours(nextTuesday, 8);
      nextTuesday = setMinutes(nextTuesday, 0);
      nextTuesday = setSeconds(nextTuesday, 0);
      
      // If it's Tuesday and already past 8:00 AM CT, move to next week
      if (dayOfWeek === 2 && isBefore(nextTuesday, now)) {
        nextTuesday = addDays(nextTuesday, 7);
      }
      
      return format(nextTuesday, "EEE, MMM d, yyyy 'at' h:mm a 'CT'");
    };
    
    setNextRefreshDate(calculateNextTuesday());
  }, []);
  
  // Check authentication state
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setIsAuthenticated(!!data.session);
      
      if (data.session) {
        const user = data.session.user;
        // Set role based on user metadata
        setUserRole(user.user_metadata?.role || "free");
        // Handle admin status
        if (user.user_metadata?.is_admin === true) {
          setUserRole("admin");
        }
      } else {
        setUserRole("guest");
      }
    };
    
    checkAuth();
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setIsAuthenticated(!!session);
        
        if (session) {
          const user = session.user;
          // Set role based on user metadata
          setUserRole(user.user_metadata?.role || "free");
          // Handle admin status
          if (user.user_metadata?.is_admin === true) {
            setUserRole("admin");
          }
        } else {
          setUserRole("guest");
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  // Add real-time functionality to the fetchGames function
  const fetchGames = async (skipLoading = false) => {
    if (!skipLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    
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
      setGeneratedDate(response.data.generatedDate || null);
      
      // Store refresh time if available
      if (response.data.refreshTime) {
        setRefreshTime(response.data.refreshTime);
      }
      
      // If API returns a role, use it (useful for confirming what the backend sees)
      if (response.data.userRole) {
        setUserRole(response.data.userRole);
      }
    } catch (error) {
      console.error('Error fetching games:', error);
      toast({
        title: "Error",
        description: "Failed to load predictions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Fetch games on sport change
  useEffect(() => {
    fetchGames();
  }, [sport, toast]);
  
  // Manual refresh handler
  const handleRefresh = () => {
    fetchGames(true);
  };
  
  // Add subscription to prediction changes
  useEffect(() => {
    // Set up a subscription to predictions table changes
    const channel = supabase
      .channel('predictions-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'predictions' },
        (payload) => {
          console.log('Predictions updated:', payload);
          // Refresh the data when predictions are updated
          fetchGames(true); 
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sport]); // Re-subscribe when sport changes
  
  const filteredGames = useMemo(() => {
    return games.filter(game => game.sport === sport);
  }, [games, sport]);
  
  // Check if we have a preview game (first game with full data for guests)
  const hasPreviewGame = userRole === 'guest' && filteredGames.some(game => game.predictedMargin !== null);
  
  // Format today's date for display
  const todayFormatted = format(new Date(), "MMM d, yyyy");
  
  return (
    <AppLayout isAuthenticated={isAuthenticated}>
      <div className="container py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Live Predictions Dashboard</h1>
            <p className="text-muted-foreground">
              Today's games with predicted margins and market edges
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
            
            <Button variant="outline" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{generatedDate || todayFormatted}</span>
            </Button>
          </div>
        </div>
        
        {nextRefreshDate && (
          <Alert className="mb-6 bg-muted">
            <Clock className="h-4 w-4" />
            <AlertTitle>Automated Predictions</AlertTitle>
            <AlertDescription>
              Predictions are automatically refreshed every Tuesday at 8:00 AM CT. 
              Next refresh: {nextRefreshDate}
            </AlertDescription>
          </Alert>
        )}
        
        {userRole === 'guest' && (
          <Alert className="mb-6 bg-muted">
            <Info className="h-4 w-4" />
            <AlertTitle>Preview Mode</AlertTitle>
            <AlertDescription>
              You're viewing in guest preview mode. One game per sport is shown with full details. 
              <Button 
                variant="link" 
                className="px-1 h-auto" 
                onClick={() => navigate('/auth/login')}
              >
                Sign in
              </Button> 
              or 
              <Button 
                variant="link" 
                className="px-1 h-auto" 
                onClick={() => navigate('/auth/register')}
              >
                create an account
              </Button> 
              to see all predictions.
            </AlertDescription>
          </Alert>
        )}
        
        {hasPreviewGame && (
          <Alert className="mb-6 border-edge-secondary bg-edge-secondary/10">
            <Info className="h-4 w-4 text-edge-secondary" />
            <AlertTitle>Preview Game</AlertTitle>
            <AlertDescription>
              The first game below shows full premium details as a preview. Create an account to access all predictions.
            </AlertDescription>
          </Alert>
        )}
        
        <SportTabs activeTab={sport} onTabChange={setSport}>
          <TabsContent value="nfl" className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading NFL predictions...</p>
              </div>
            ) : (
              filteredGames.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredGames.map(game => (
                    <GameCard 
                      key={game.id} 
                      {...game} 
                      isPreview={game.isPreviewGame}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border rounded-lg bg-card p-8">
                  <p className="text-xl font-medium text-foreground mb-2">No NFL games scheduled today</p>
                  <p className="text-muted-foreground">Check back later or during the NFL season for predictions.</p>
                </div>
              )
            )}
          </TabsContent>
          
          <TabsContent value="ncaaf" className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading NCAAF predictions...</p>
              </div>
            ) : (
              filteredGames.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredGames.map(game => (
                    <GameCard 
                      key={game.id} 
                      {...game}
                      isPreview={game.isPreviewGame}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border rounded-lg bg-card p-8">
                  <p className="text-xl font-medium text-foreground mb-2">No NCAAF games scheduled today</p>
                  <p className="text-muted-foreground">Check back later or during the NCAAF season for predictions.</p>
                </div>
              )
            )}
          </TabsContent>
          
          <TabsContent value="ncaab" className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading NCAAB predictions...</p>
              </div>
            ) : (
              filteredGames.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredGames.map(game => (
                    <GameCard 
                      key={game.id} 
                      {...game}
                      isPreview={game.isPreviewGame}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border rounded-lg bg-card p-8">
                  <p className="text-xl font-medium text-foreground mb-2">No NCAAB games scheduled today</p>
                  <p className="text-muted-foreground">Check back later or during the NCAAB season for predictions.</p>
                </div>
              )
            )}
          </TabsContent>
          
          <TabsContent value="mlb" className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading MLB predictions...</p>
              </div>
            ) : (
              filteredGames.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredGames.map(game => (
                    <GameCard 
                      key={game.id} 
                      {...game}
                      isPreview={game.isPreviewGame}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border rounded-lg bg-card p-8">
                  <p className="text-xl font-medium text-foreground mb-2">No MLB games scheduled today</p>
                  <p className="text-muted-foreground">Check back later or during the MLB season for predictions.</p>
                </div>
              )
            )}
          </TabsContent>
        </SportTabs>
        
        {userRole !== 'premium' && userRole !== 'admin' && (
          <PremiumBanner />
        )}
        
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
              <div className="flex items-center gap-1 mb-1">
                <Clock className="h-3 w-3" />
                <p>Data refreshed every Tuesday at {refreshTime}.</p>
              </div>
              <p>All times displayed in CT (America/Chicago).</p>
              <p>Last updated: {generatedDate || todayFormatted}</p>
              {nextRefreshDate && <p>Next refresh: {nextRefreshDate}</p>}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
