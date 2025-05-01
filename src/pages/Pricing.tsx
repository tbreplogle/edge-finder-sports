import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PricingCard } from "@/components/PricingCard";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { AppLayout } from "@/components/AppLayout";
const Pricing = () => {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is logged in and get their current plan
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setIsAuthenticated(true);
        // In a real app, this would fetch from an API or Supabase
        // For demo, we'll assume all logged-in users are on the basic plan by default
        setCurrentPlan("basic");
      } catch (e) {
        console.error("Error parsing user data:", e);
        setIsAuthenticated(false);
        setCurrentPlan(null);
      }
    } else {
      setIsAuthenticated(false);
      setCurrentPlan(null);
    }
  }, []);
  const basicFeatures = [{
    text: "Today's games preview",
    included: true
  }, {
    text: "NFL edges up to ±2 points",
    included: true
  }, {
    text: "Basic mobile access",
    included: true
  }, {
    text: "Full edge values",
    included: false
  }, {
    text: "Historical dashboard",
    included: false
  }, {
    text: "Custom alerts",
    included: false
  }, {
    text: "CSV exports",
    included: false
  }];
  const premiumFeatures = [{
    text: "Today's games preview",
    included: true
  }, {
    text: "NFL edges up to ±2 points",
    included: true
  }, {
    text: "Basic mobile access",
    included: true
  }, {
    text: "Full edge values",
    included: true
  }, {
    text: "Historical dashboard",
    included: true
  }, {
    text: "Custom alerts",
    included: true
  }, {
    text: "CSV exports",
    included: true
  }];
  const enterpriseFeatures = [{
    text: "Today's games preview",
    included: true
  }, {
    text: "NFL edges up to ±2 points",
    included: true
  }, {
    text: "Basic mobile access",
    included: true
  }, {
    text: "Full edge values",
    included: true
  }, {
    text: "Historical dashboard",
    included: true
  }, {
    text: "Custom alerts",
    included: true
  }, {
    text: "CSV exports",
    included: true
  }, {
    text: "API access",
    included: true
  }, {
    text: "Private formula consultation",
    included: true
  }];
  const handleSelectPlan = (plan: string) => {
    // For demo purposes just log the selected plan
    console.log(`Selected plan: ${plan}`);
    // Here you would normally redirect to authentication if not logged in
    if (!isAuthenticated) {
      navigate("/auth/register");
    }
  };
  const handleBillingToggle = () => {
    setBillingCycle(billingCycle === "monthly" ? "yearly" : "monthly");
  };
  return <AppLayout>
      <main className="flex-1 container py-12">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Choose Your Plan
          </h1>
          <p className="text-muted-foreground">
            Select the plan that best fits your needs. All plans include access to our core prediction dashboard.
          </p>
          
          {/* Billing cycle selector */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span className={`text-sm ${billingCycle === "monthly" ? "font-medium" : "text-muted-foreground"}`}>
              Monthly
            </span>
            <Switch checked={billingCycle === "yearly"} onCheckedChange={handleBillingToggle} />
            <span className={`text-sm ${billingCycle === "yearly" ? "font-medium" : "text-muted-foreground"}`}>
              Yearly (Save 15%)
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <PricingCard type="basic" title="Basic" price="Free" description="For casual fans just getting started" features={basicFeatures} isCurrentPlan={isAuthenticated && currentPlan === "basic"} billingCycle={billingCycle} onSelectPlan={() => handleSelectPlan("basic")} isAuthenticated={isAuthenticated} />
          
          <PricingCard type="premium" title="Premium" price={billingCycle === "monthly" ? "$19.99" : "$203.88"} description="For serious bettors and analysts" features={premiumFeatures} highlighted={true} isCurrentPlan={isAuthenticated && currentPlan === "premium"} billingCycle={billingCycle} onSelectPlan={() => handleSelectPlan("premium")} isAuthenticated={isAuthenticated} />
          
          <PricingCard type="enterprise" title="Enterprise" price={billingCycle === "monthly" ? "$99.99" : "$1,019.88"} description="For professional organizations" features={enterpriseFeatures} isCurrentPlan={isAuthenticated && currentPlan === "enterprise"} billingCycle={billingCycle} onSelectPlan={() => handleSelectPlan("enterprise")} isAuthenticated={isAuthenticated} />
        </div>
        
        <div className="max-w-3xl mx-auto mt-16">
          <h2 className="text-xl font-bold mb-6">Frequently Asked Questions</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-2">How often is the data updated?</h3>
              <p className="text-muted-foreground">Data is refreshed every 15 minutes during active seasons across all supported sports. Predictive model updates are released every Tuesday at 8:00 AM CT.</p>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Can I cancel my subscription anytime?</h3>
              <p className="text-muted-foreground">
                Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your billing period.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">What payment methods do you accept?</h3>
              <p className="text-muted-foreground">We only accept PayPal through our secure payment processor.</p>
            </div>
            
            <div>
              
              
            </div>
          </div>
        </div>
        
        <div className="bg-card border rounded-lg p-6 md:p-8 mt-12 max-w-3xl mx-auto">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2">Need a custom solution?</h3>
              <p className="text-muted-foreground mb-4">
                Contact us for custom enterprise features, API integration, or consulting services.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-edge-secondary" />
                  <span>Custom algorithm development</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-edge-secondary" />
                  <span>Private data feeds</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-edge-secondary" />
                  <span>White-label solutions</span>
                </li>
              </ul>
            </div>
            <div className="flex-none">
              <Button variant="outline" onClick={() => navigate("/contact")}>
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </main>
    </AppLayout>;
};
export default Pricing;