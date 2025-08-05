import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileNavLogo } from "./MobileNavLogo";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  showMembersTab: boolean;
}

export function MobileNav({
  isOpen,
  onClose,
  isAuthenticated = false,
  isAdmin = false,
  showMembersTab = false,
}: MobileNavProps) {
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
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="bg-background/90 backdrop-blur-sm flex-grow" onClick={onClose}></div>
      {/* Drawer */}
      <div className="relative w-3/4 max-w-xs bg-background">
        <div className="p-4 flex items-center justify-between border-b">
          <MobileNavLogo />
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="p-4 space-y-1">
          <Button
            variant="ghost"
            className="w-full text-left"
            onClick={(e) => {
              e.preventDefault();
              navigate("/dashboard");
              onClose();
            }}
          >
            Dashboard
          </Button>
          <Button
            variant="ghost"
            className="w-full text-left"
            onClick={(e) => {
              e.preventDefault();
              navigate("/history");
              onClose();
            }}
          >
            History
          </Button>
          <Button
            variant="ghost"
            className="w-full text-left"
            onClick={(e) => {
              e.preventDefault();
              navigate("/injuries");
              onClose();
            }}
          >
            Injuries
          </Button>
          <Button
            variant="ghost"
            className="w-full text-left"
            onClick={(e) => {
              e.preventDefault();
              navigate("/pricing");
              onClose();
            }}
          >
            Pricing
          </Button>
          {showMembersTab && (
            <Button
              variant="ghost"
              className="w-full text-left"
              onClick={(e) => {
                e.preventDefault();
                navigate("/members");
                onClose();
              }}
            >
              Picks
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="ghost"
              className="w-full text-left"
              onClick={(e) => {
                e.preventDefault();
                navigate("/admin/dashboard");
                onClose();
              }}
            >
              Admin
            </Button>
          )}
          {isAuthenticated ? (
            <>
              <Button
                variant="ghost"
                className="w-full text-left"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/account");
                  onClose();
                }}
              >
                My Account
              </Button>
              {isAdmin && (
                <Button
                  variant="ghost"
                  className="w-full text-left"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/admin/access-control");
                    onClose();
                  }}
                >
                  Access Control
                </Button>
              )}
              <Button
                variant="ghost"
                className="w-full text-left"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/auth/logout");
                  onClose();
                }}
              >
                Log out
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                className="w-full text-left"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/auth/register");
                  onClose();
                }}
              >
                Get Started
              </Button>
              <Button
                variant="ghost"
                className="w-full text-left"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/auth/login");
                  onClose();
                }}
              >
                Sign in
              </Button>
            </>
          )}
        </nav>
      </div>
    </div>
  );
}
