
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
}

export function MobileNav({ isOpen, onClose, isAuthenticated = false, isAdmin = false }: MobileNavProps) {
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

  // Always display admin tab, access control is handled at the page level
  const showAdminTab = true;
  
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
          {showAdminTab && (
            <div className="border-l-2 border-edge-secondary pl-3">
              <span className="text-sm font-semibold text-edge-secondary">ADMIN</span>
              <a 
                href="/admin/logic"
                className="block py-2 text-edge-secondary transition-colors hover:text-edge-secondary/80"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/admin/logic");
                  onClose();
                }}
              >
                Logic Lab
              </a>
            </div>
          )}
        </nav>
        
        <div className="mt-auto pb-8">
          {isAuthenticated ? (
            <div className="flex flex-col gap-4">
              <Button 
                className="w-full" 
                onClick={() => {
                  navigate("/account");
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
