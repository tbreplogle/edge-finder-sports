
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated?: boolean;
}

export function MobileNav({ isOpen, onClose, isAuthenticated = false }: MobileNavProps) {
  const navigate = useNavigate();
  
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60">
      <div className="container h-full flex flex-col">
        <div className="flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2 text-xl font-bold text-edge-secondary">
            <span>PlayEdge</span>
          </a>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <nav className="flex flex-col gap-6 text-lg mt-8">
          <a 
            href="/dashboard"
            className="py-2 text-foreground/70 transition-colors hover:text-foreground"
            onClick={(e) => {
              e.preventDefault();
              navigate("/dashboard");
              onClose();
            }}
          >
            Dashboard
          </a>
          <a 
            href="/history"
            className="py-2 text-foreground/70 transition-colors hover:text-foreground"
            onClick={(e) => {
              e.preventDefault();
              navigate("/history");
              onClose();
            }}
          >
            History
          </a>
          <a 
            href="/pricing"
            className="py-2 text-foreground/70 transition-colors hover:text-foreground"
            onClick={(e) => {
              e.preventDefault();
              navigate("/pricing");
              onClose();
            }}
          >
            Pricing
          </a>
        </nav>
        
        <div className="mt-auto pb-8">
          {isAuthenticated ? (
            <div className="flex flex-col gap-4">
              <Button 
                className="w-full" 
                onClick={() => {
                  navigate("/profile");
                  onClose();
                }}
              >
                My Account
              </Button>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => {
                  navigate("/auth/logout");
                  onClose();
                }}
              >
                Log out
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Button 
                className="w-full" 
                onClick={() => {
                  navigate("/auth/register");
                  onClose();
                }}
              >
                Get Started
              </Button>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => {
                  navigate("/auth/login");
                  onClose();
                }}
              >
                Sign in
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
