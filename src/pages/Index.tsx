
import { AppLayout } from '@/components/AppLayout';
import { FeaturedGame } from '@/components/FeaturedGame';
import { MatchupTicker } from '@/components/MatchupTicker';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function Index() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const navigate = useNavigate();

  // Check if user is admin or paid
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setIsAdmin(user.is_admin === true);
        setIsPaid(user.role === "premium" || user.is_admin === true);
        
        // Redirect to /admin if the user is an admin
        if (user.is_admin === true) {
          navigate('/admin/sports/nfl');
        }
      } catch (e) {
        console.error("Error parsing user data:", e);
      }
    }
  }, [navigate]);

  return (
    <AppLayout>
      <section className="py-12 bg-edge-primary/10">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-6">
              Sports Predictions & Betting Edges
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Get data-driven predictions and find value in the betting markets across all major sports.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button 
                size="lg" 
                onClick={() => navigate("/dashboard")}
                className="bg-edge-secondary hover:bg-edge-secondary/90"
              >
                View Today's Predictions
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate("/pricing")}
              >
                Pricing Plans
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Games */}
      <section className="py-12 md:py-16">
        <div className="container">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Featured Games</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeaturedGame isPreview={true} />
            <FeaturedGame isPreview={true} />
            <FeaturedGame isPreview={true} />
          </div>
        </div>
      </section>

      <section className="py-12 bg-edge-bg">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-muted-foreground mb-6">
              Join thousands of smart bettors using our predictions to find value bets.
            </p>
            <Button 
              size="lg"
              onClick={() => navigate("/auth/register")}
              className="bg-edge-secondary hover:bg-edge-secondary/90"
            >
              Sign Up Now
            </Button>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
