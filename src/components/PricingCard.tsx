
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadPayPal } from "@/utils/paypalScript";
import { useNavigate } from "react-router-dom";

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
const PAYPAL_BUTTON_IDS = {
  basic: {
    monthly: null,
    yearly: null
  },
  premium: {
    monthly: "V953RFZLU5TLL",
    yearly: "V953RYYYYYYY"
  },
  enterprise: {
    monthly: "V953RFENTER",
    yearly: "V953RFENTERYR"
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
  const buttonId = PAYPAL_BUTTON_IDS[type]?.[billingCycle];
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!showPayPal || !buttonId) return;
    
    // Reset error state on each attempt
    setPaypalError(null);
    
    loadPayPal()
      .then(() => {
        setPaypalLoaded(true);
        
        // Ensure the PayPal object and HostedButtons are available
        if (window.paypal && window.paypal.HostedButtons) {
          try {
            // Clear the container first to prevent duplicated buttons
            const container = document.getElementById(`paypal-container-${type}-${billingCycle}`);
            if (container) container.innerHTML = '';
            
            // Render the button with the correct button ID (Fix #4)
            window.paypal.HostedButtons({ 
              hostedButtonId: buttonId 
            }).render(`#paypal-container-${type}-${billingCycle}`);
          } catch (err: any) {
            console.error("Error rendering PayPal button:", err);
            setPaypalError(`Could not display PayPal button: ${err.message}`);
          }
        } else {
          setPaypalError("PayPal Hosted Buttons not available");
        }
      })
      .catch((err: any) => {
        console.error("Error loading PayPal:", err);
        setPaypalError(`PayPal error: ${err.message}`);
        setPaypalLoaded(false);
      });
  }, [showPayPal, buttonId, type, billingCycle]);
  
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
          {price !== "Free" && <span className="text-muted-foreground">/{billingCycle === "monthly" ? "month" : "year"}</span>}
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
      
      {showPayPal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 shadow-lg">
            <div className="text-center mb-4">
              <h3 className="font-medium">{title} Plan</h3>
              <p className="text-sm text-muted-foreground">
                {price}/{billingCycle === "monthly" ? "month" : "year"}
              </p>
            </div>
            
            <div
              id={`paypal-container-${type}-${billingCycle}`}
              className="min-w-[300px]"
            >
              {!paypalLoaded && !paypalError && (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  Loading PayPal...
                </div>
              )}
              
              {paypalError && (
                <div className="py-4 text-center text-sm text-red-500">
                  {paypalError}
                </div>
              )}
            </div>
            
            <Button 
              variant="ghost" 
              className="mt-4 w-full text-sm"
              onClick={() => setShowPayPal(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
