
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, RefreshCcw } from "lucide-react";
import { loadPayPal, renderPayPalButton } from "@/utils/paypalScript";
import { useToast } from "@/hooks/use-toast";

interface PayPalCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  price: string;
  buttonId: string;
  containerId: string;
}

export function PayPalCheckoutModal({
  isOpen,
  onClose,
  title,
  price,
  buttonId,
  containerId,
}: PayPalCheckoutModalProps) {
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [paypalError, setPaypalError] = useState<string | null>(null);
  const [isLoadingPayPal, setIsLoadingPayPal] = useState(false);
  const { toast } = useToast();

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
    if (isOpen && buttonId) {
      loadPayPalScript();
    }
  }, [isOpen, buttonId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="w-[90vw] max-w-sm sm:max-w-md rounded-lg bg-background p-6 shadow-2xl
                  flex flex-col items-center text-center space-y-5"
      >
        <button
          onClick={onClose}
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
          onClick={onClose}
          className="text-xs underline text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
