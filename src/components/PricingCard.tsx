import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckIcon, RefreshCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadPayPal, isPayPalLoaded, renderPayPalButton } from "@/utils/paypalScript";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface PricingFeature {
  text: string;
  included: boolean;
}

interface PricingCardProps {
  type: "basic" | "premium" | "enterprise";
  title: string;
  price: string;
  description: string;
  features: PricingFeature[];
  highlighted?: boolean;
  isCurrentPlan?: boolean;
  billingCycle: "monthly" | "yearly";
  onSelectPlan: () => void;
  isAuthenticated: boolean;
}

// PayPal button IDs for different plans and billing cycles
// Using sandbox button IDs that are valid for testing
const PAYPAL_BUTTON_IDS = {
  basic: {
    monthly: "TPLREYRLUKUL4", // Demo button ID for basic monthly
    yearly: "STU5JRQLPCNPS"   // Demo button ID for basic yearly
  },
  premium: {
    monthly: "V953RFZLU5TLL", // Production button ID for premium monthly
    yearly: "DSXNW4WZXKR6S"   // Production button ID for premium yearly
  },
  enterprise: {
    monthly: "6MSNH8L4LWVGY", // Production button ID for enterprise monthly
    yearly: "YFPNWKVSSTX9W"   // Production button ID for enterprise yearly
  }
};

export function PricingCard({
  type,
  title,
  price,
  description,
  features,
  highlighted = false,
  isCurrentPlan = false,
  billingCycle,
  onSelectPlan,
  isAuthenticated
}: PricingCardProps) {
  const [showPayPal, setShowPayPal] = useState(false);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [paypalError, setPaypalError] = useState<string | null>(null);
  const [isLoadingPayPal, setIsLoadingPayPal] = useState(false);
  const buttonId = PAYPAL_BUTTON_IDS[type]?.[billingCycle];
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Create a unique container ID for this pricing card
  const containerId = `paypal-container-${type}-${billingCycle}`;
  
  const loadPayPalScript = () => {
    // Don't try loading if already loading
    if (isLoadingPayPal) return;
    
    // Reset states
    setPaypalError(null);
    setIsLoadingPayPal(true);
    
    loadPayPal()
      .then(() => {
        setPaypalLoaded(true);
        setIsLoadingPayPal(false);
        
        // Short delay to ensure DOM is stable before rendering
        setTimeout(() => {
          if (buttonId) {
            renderPayPalButton(containerId, buttonId)
              .catch((err) => {
                console.error("Failed to render PayPal button:", err);
                setPaypalError(`Could not load PayPal checkout: ${err.message}`);
                toast({
                  title: "PayPal Checkout Error",
                  description: "Could not load the PayPal checkout. Please try again later.",
                  variant: "destructive"
                });
              });
          } else {
            setPaypalError("Invalid PayPal configuration");
          }
        }, 100);
      })
      .catch((err: any) => {
        console.error("Error loading PayPal:", err);
        setPaypalError(`PayPal error: ${err.message || String(err)}`);
        setPaypalLoaded(false);
        setIsLoadingPayPal(false);
        toast({
          title: "PayPal Connection Failed",
          description: "Could not connect to PayPal. Please check your connection and try again.",
          variant: "destructive"
        });
      });
  };
  
  // Effect to handle PayPal initialization
  useEffect(() => {
    // Only load PayPal when showPayPal is true and we have a button ID
    if (showPayPal && buttonId) {
      loadPayPalScript();
    }
  }, [showPayPal, buttonId]);
  
  const handleSelectPlan = () => {
    // If user is not authenticated, redirect to login
    if (!isAuthenticated) {
      // Pass the current URL as the return URL after login
      navigate("/auth/login", { 
        state: { returnUrl: "/pricing" } 
      });
      return;
    }
    
    if (buttonId) {
      setShowPayPal(true);
    } else {
      // For free plan or if no PayPal button ID exists
      onSelectPlan();
    }
  };

  const handleClosePayPal = () => {
    setShowPayPal(false);
  };

  return (
    <Card className={cn(
      "flex flex-col",
      highlighted && "border-edge-secondary shadow-md"
    )}>
      <CardHeader>
        <CardTitle className="flex items-start justify-between">
          <span>{title}</span>
          {isAuthenticated && isCurrentPlan && (
            <span className="text-xs bg-edge-secondary/20 text-edge-secondary px-2 py-1 rounded-full">
              Current Plan
            </span>
          )}
        </CardTitle>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">{price}</span>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-2 text-sm">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <CheckIcon className={cn(
                "h-4 w-4 mr-2 mt-0.5",
                feature.included ? "text-edge-secondary" : "text-muted-foreground/50"
              )} />
              <span className={cn(
                !feature.included && "text-muted-foreground/70 line-through"
              )}>
                {feature.text}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button 
          variant={highlighted ? "default" : "outline"}
          className={cn(
            "w-full",
            highlighted && "bg-edge-secondary hover:bg-edge-secondary/90"
          )}
          disabled={isAuthenticated && isCurrentPlan}
          onClick={handleSelectPlan}
        >
          {isAuthenticated && isCurrentPlan ? "Current Plan" : "Select Plan"}
        </Button>
      </CardFooter>
      
      {/* PayPal Modal */}
      {showPayPal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className="w-[90vw] max-w-sm sm:max-w-md rounded-lg bg-background p-6 shadow-2xl
                     flex flex-col items-center text-center space-y-5"
          >
            <button
              onClick={() => setShowPayPal(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-lg font-semibold">{title} Plan</h3>
            <p className="text-sm text-muted-foreground">{price}</p>

            {/* PayPal button container */}
            <div
              id={containerId}
              className="paypal-hosted-button w-full min-h-[48px]"
              style={{ width: "100%" }}
            >
              {isLoadingPayPal && !paypalError && (
                <div className="py-4 text-center">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Loading PayPal...</p>
                </div>
              )}
              
              {paypalError && (
                <div className="py-4 text-center">
                  <p className="text-sm text-red-500 mb-4">{paypalError}</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={loadPayPalScript}
                    className="flex items-center gap-2"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Try Again
                  </Button>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowPayPal(false)}
              className="text-xs underline text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
