
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { PricingFeatureList } from "./PricingFeatureList";
import { PayPalCheckoutModal } from "./PayPalCheckoutModal";

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
  const buttonId = PAYPAL_BUTTON_IDS[type]?.[billingCycle];
  const navigate = useNavigate();
  
  // Create a unique container ID for this pricing card
  const containerId = `paypal-container-${type}-${billingCycle}`;
  
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
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <PricingFeatureList features={features} />
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
      
      <PayPalCheckoutModal
        isOpen={showPayPal}
        onClose={() => setShowPayPal(false)}
        title={title}
        price={price}
        buttonId={buttonId || ''}
        containerId={containerId}
      />
    </Card>
  );
}
