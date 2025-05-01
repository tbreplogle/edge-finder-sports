
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
const PAYPAL_BUTTON_IDS = {
  basic: {
    monthly: null,
    yearly: null
  },
  premium: {
    monthly: "V953RFZLU5TLL", // Production button ID
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
            renderPayPalButton(containerId, buttonId);
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
    
    // Clean up function to manage cleanup when modal closes
    return () => {
      // No need to do anything specific here as we're using a better container management approach
    };
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
    // Close the modal
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg p-6 shadow-lg max-w-md w-full relative">
            <button 
              onClick={handleClosePayPal}
              className="absolute right-4 top-4 p-1 rounded-full hover:bg-muted"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            
            <div className="text-center mb-6">
              <h3 className="text-lg font-medium">{title} Plan</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {price}/{billingCycle === "monthly" ? "month" : "year"}
              </p>
            </div>
            
            <div
              id={containerId}
              className="min-w-[300px] min-h-[150px] flex items-center justify-center py-4"
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
            
            <Button 
              variant="ghost" 
              className="mt-4 w-full text-sm"
              onClick={handleClosePayPal}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
