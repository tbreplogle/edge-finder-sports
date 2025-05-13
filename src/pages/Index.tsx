import { AppLayout } from '@/components/AppLayout';
import { FeaturedGame } from '@/components/FeaturedGame';
import { MatchupTicker } from '@/components/MatchupTicker';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { accessRulesRouter } from "./routes/accessRules";
app.use("/api/access-rules", accessRulesRouter);
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

        // Removed automatic redirect to admin page
      } catch (e) {
        console.error("Error parsing user data:", e);
      }
    }
  }, [navigate]);
  return <AppLayout isAuthenticated={!!localStorage.getItem("user")}>
      <section className="w-full py-8 sm:py-10 md:py-12 lg:py-16 bg-edge-primary/10">
        <div className="w-full mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 sm:mb-6 lg:text-4xl">Get data-driven predictions and betting edges for NFL, NCAAF, NCAAB and MLB.</h1>
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-6 sm:mb-8">
              Get data-driven predictions and find value in the betting markets across all major sports.
            </p>
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
              <Button size="lg" onClick={() => navigate("/dashboard")} className="bg-edge-secondary hover:bg-edge-secondary/90 text-base sm:text-lg">
                View Today's Predictions
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/pricing")} className="text-base sm:text-lg">
                Pricing Plans
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Games */}
      <section className="w-full py-8 sm:py-10 md:py-16 lg:py-20">
        <div className="w-full mx-auto">
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6 lg:mb-8 text-left">Featured Games</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-8">
            <FeaturedGame isPreview={true} />
            <FeaturedGame isPreview={true} />
            <FeaturedGame isPreview={true} />
          </div>
        </div>
      </section>

      <section className="w-full py-8 sm:py-10 md:py-12 lg:py-16 bg-edge-bg">
        <div className="w-full mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-2 sm:mb-4">Ready to get started?</h2>
            <p className="text-lg md:text-xl text-muted-foreground mb-4 sm:mb-6">
              Join thousands of smart bettors using our predictions to find value bets.
            </p>
            <Button size="lg" onClick={() => navigate("/auth/register")} className="bg-edge-secondary hover:bg-edge-secondary/90 text-base sm:text-lg">
              Sign Up Now
            </Button>
          </div>
        </div>
      </section>
    </AppLayout>;
}
