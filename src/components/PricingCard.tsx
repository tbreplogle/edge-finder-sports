
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadPayPal } from "@/utils/paypalScript";

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
  onSelectPlan
}: PricingCardProps) {
  const [showPayPal, setShowPayPal] = useState(false);
  const buttonId = PAYPAL_BUTTON_IDS[type]?.[billingCycle];
  
  useEffect(() => {
    if (!showPayPal || !buttonId) return;
    
    loadPayPal().then(() => {
      // @ts-ignore - PayPal SDK is loaded dynamically
      if (window.paypal && window.paypal.HostedButtons) {
        // @ts-ignore - PayPal types aren't available
        window.paypal.HostedButtons({ 
          hostedButtonId: buttonId
        }).render(`#paypal-container-${type}-${billingCycle}`);
      }
    });
  }, [showPayPal, buttonId, type, billingCycle]);
  
  const handleSelectPlan = () => {
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
          {isCurrentPlan && (
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
          disabled={isCurrentPlan || (type !== "basic" && !buttonId)}
          onClick={handleSelectPlan}
        >
          {isCurrentPlan ? "Current Plan" : "Select Plan"}
        </Button>
      </CardFooter>
      
      {showPayPal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 shadow-lg">
            <div
              id={`paypal-container-${type}-${billingCycle}`}
              className="min-w-[300px]"
            />
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
