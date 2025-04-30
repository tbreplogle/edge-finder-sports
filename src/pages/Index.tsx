
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle, 
  BarChart3, 
  ArrowUpRight, 
  Bell, 
  TrendingUp 
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-12 md:py-24 lg:py-32 container">
          <div className="mx-auto flex flex-col items-center space-y-4 text-center">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tighter">
              Find Your <span className="text-edge-secondary">Edge</span> With Data-Driven Predictions
            </h1>
            <p className="max-w-[700px] text-muted-foreground md:text-xl/relaxed">
              Proprietary algorithms analyzing real-time sports data to give you the statistical edge in NCAAB, NCAAF, NFL, and MLB.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <Button 
                size="lg" 
                onClick={() => navigate("/dashboard")}
                className="group"
              >
                View Today's Edges
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => navigate("/pricing")}
              >
                See Pricing
              </Button>
            </div>
          </div>
        </section>
        
        {/* Features Grid */}
        <section className="py-12 md:py-24 container">
          <div className="mx-auto grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg">
              <div className="h-12 w-12 rounded-full bg-edge-secondary/20 flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-edge-secondary" />
              </div>
              <h3 className="text-lg font-bold mb-2">Proprietary Formulas</h3>
              <p className="text-muted-foreground">
                Unlocking edges in the market through rigorous quantitative analysis.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg">
              <div className="h-12 w-12 rounded-full bg-edge-secondary/20 flex items-center justify-center mb-4">
                <ArrowUpRight className="h-6 w-6 text-edge-secondary" />
              </div>
              <h3 className="text-lg font-bold mb-2">Live Updates</h3>
              <p className="text-muted-foreground">
                Data refreshed every 15 minutes during season for the most current predictions.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg">
              <div className="h-12 w-12 rounded-full bg-edge-secondary/20 flex items-center justify-center mb-4">
                <Bell className="h-6 w-6 text-edge-secondary" />
              </div>
              <h3 className="text-lg font-bold mb-2">Custom Alerts</h3>
              <p className="text-muted-foreground">
                Get notified when edges match your specified criteria.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg">
              <div className="h-12 w-12 rounded-full bg-edge-secondary/20 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-edge-secondary" />
              </div>
              <h3 className="text-lg font-bold mb-2">Historical Analysis</h3>
              <p className="text-muted-foreground">
                Track performance over time with comprehensive historical dashboards.
              </p>
            </div>
          </div>
        </section>
        
        {/* Sports Coverage */}
        <section className="py-12 md:py-24 bg-edge-primary/30">
          <div className="container">
            <div className="mx-auto flex flex-col items-center text-center">
              <h2 className="text-2xl md:text-4xl font-bold mb-6">Comprehensive Sports Coverage</h2>
              <p className="max-w-[700px] text-muted-foreground md:text-lg mb-12">
                From college hoops to the big leagues, we've got all your favorite sports covered with detailed predictions.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="bg-card p-6 rounded-lg border-t-4 border-edge-nfl">
                  <h3 className="font-bold mb-2">NFL</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Professional football predictions with detailed factor analysis.
                  </p>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-edge-secondary mr-2" />
                      <span>Team-specific analytics</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-edge-secondary mr-2" />
                      <span>Injury impact assessment</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-card p-6 rounded-lg border-t-4 border-edge-ncaaf">
                  <h3 className="font-bold mb-2">NCAAF</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    College football edges based on YPP and pace metrics.
                  </p>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-edge-secondary mr-2" />
                      <span>Conference strength ratings</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-edge-secondary mr-2" />
                      <span>Home field advantage models</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-card p-6 rounded-lg border-t-4 border-edge-ncaab">
                  <h3 className="font-bold mb-2">NCAAB</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    College basketball predictions with tempo consideration.
                  </p>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-edge-secondary mr-2" />
                      <span>Offensive efficiency metrics</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-edge-secondary mr-2" />
                      <span>Strength of schedule analysis</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-card p-6 rounded-lg border-t-4 border-edge-mlb">
                  <h3 className="font-bold mb-2">MLB</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Baseball projections incorporating starting pitcher data.
                  </p>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-edge-secondary mr-2" />
                      <span>Pitching matchup analysis</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-edge-secondary mr-2" />
                      <span>Ballpark factor adjustments</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              <Button 
                onClick={() => navigate("/dashboard")} 
                className="mt-12"
              >
                See Today's Predictions
              </Button>
            </div>
          </div>
        </section>
        
        {/* CTA Section */}
        <section className="py-12 md:py-24 container">
          <div className="mx-auto max-w-4xl bg-gradient-to-r from-edge-primary to-edge-neutral rounded-lg p-8 md:p-12">
            <div className="flex flex-col md:flex-row justify-between items-center gap-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to Find Your Edge?</h2>
                <p className="text-muted-foreground mb-6">
                  Start with a free account to see today's predictions or upgrade for premium features.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  variant="default" 
                  size="lg"
                  onClick={() => navigate("/auth/register")}
                  className="bg-edge-secondary hover:bg-edge-secondary/90"
                >
                  Get Started Free
                </Button>
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => navigate("/pricing")}
                >
                  View Pricing
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;
