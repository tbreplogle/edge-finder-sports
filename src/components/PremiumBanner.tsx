
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

export function PremiumBanner() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setIsAdmin(user.is_admin === true);
      } catch (e) {
        console.error("Error parsing user data:", e);
      }
    }
  }, []);
  
  // Hide banner for admin users
  if (isAdmin) {
    return null;
  }
  
  return (
    <div className="bg-gradient-to-r from-edge-primary to-edge-neutral rounded-lg p-5 md:p-8 shadow-lg my-8">
      <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <Lock className="h-5 w-5 text-edge-secondary" />
            <h3 className="text-xl font-bold text-edge-secondary">Premium Features Locked</h3>
          </div>
          
          <p className="text-foreground/80 mb-4">
            Upgrade to a premium subscription to unlock full edge values, historical data, and more.
          </p>
          
          <ul className="space-y-2 mb-6">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-edge-secondary" />
              <span>Full edge values across all sports</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-edge-secondary" />
              <span>Historical dashboard with advanced analytics</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-edge-secondary" />
              <span>Custom alerts when edges match your criteria</span>
            </li>
          </ul>
        </div>
        
        <div className="flex-none">
          <Button 
            size="lg"
            className="group"
            onClick={() => navigate("/pricing")}
          >
            Upgrade Now
            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </div>
  );
}
