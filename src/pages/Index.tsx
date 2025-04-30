
import { AppLayout } from "@/components/AppLayout";
import { LiveScores } from "@/components/LiveScores";
import { MatchupTicker } from "@/components/MatchupTicker";
import { FeaturedGame } from "@/components/FeaturedGame";
import { PremiumBanner } from "@/components/PremiumBanner";
import { LatestNews } from "@/components/LatestNews";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

const Index = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string>("guest");
  
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
  
  const isPremium = userRole === "premium" || userRole === "admin";
  
  return (
    <AppLayout isAuthenticated={isAuthenticated}>
      {/* Live Ticker Banner */}
      <MatchupTicker />
      
      {/* Hero Section */}
      <section className="py-12 bg-edge-bg">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Sports Predictions & Analytics
              </h1>
              <p className="text-lg text-muted-foreground mb-6">
                Get data-driven predictions for NFL, NCAAF, NCAAB, and MLB games.
                Identify betting edges and make smarter decisions.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/dashboard")}
                  className="bg-edge-secondary hover:bg-edge-secondary/90"
                >
                  View Predictions
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                {!isAuthenticated && (
                  <Button 
                    variant="outline" 
                    size="lg"
                    onClick={() => navigate("/auth/register")}
                  >
                    Create Free Account
                  </Button>
                )}
              </div>
            </div>
            
            <div className="bg-edge-primary/10 p-6 rounded-lg border border-edge-primary/20">
              <LiveScores />
            </div>
          </div>
        </div>
      </section>
      
      {/* Featured Game */}
      <section className="py-12 bg-card">
        <div className="container">
          <h2 className="text-3xl font-bold mb-8">Today's Featured Games</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeaturedGame 
              sport="nfl" 
              isPaid={isPremium}
              isAdmin={userRole === "admin"} 
            />
            <FeaturedGame 
              sport="ncaaf" 
              isPaid={isPremium}
              isAdmin={userRole === "admin"} 
            />
            <FeaturedGame 
              sport="ncaab" 
              isPaid={isPremium}
              isAdmin={userRole === "admin"} 
            />
          </div>
          
          <div className="mt-8 text-center">
            <Button 
              onClick={() => navigate("/dashboard")}
              variant="outline" 
              size="lg"
              className="gap-2"
            >
              See All Predictions
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
      
      {/* Latest News */}
      <section className="py-12 bg-edge-bg">
        <div className="container">
          <h2 className="text-3xl font-bold mb-8">Latest Sports News</h2>
          <LatestNews />
        </div>
      </section>
      
      {/* Premium Banner */}
      {!isPremium && (
        <PremiumBanner />
      )}
    </AppLayout>
  );
};

export default Index;
