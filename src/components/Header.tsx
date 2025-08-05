
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "./Logo";
import { MobileNav } from "./MobileNav";
import { HeaderNavLinks } from "./HeaderNavLinks";
import { UserMenu } from "./UserMenu";
import { NotificationsMenu } from "./NotificationsMenu";

interface HeaderProps {
  isAuthenticated?: boolean;
  isAdmin?: boolean;
}

export function Header({
  isAuthenticated = false,
  isAdmin = false
}: HeaderProps) {
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>("guest");
  const [alerts, setAlerts] = useState<any[]>([]);
  const [hasNewAlerts, setHasNewAlerts] = useState(false);

  // Get user role
  useEffect(() => {
    const checkUserRole = async () => {
      if (isAuthenticated) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          // Set role based on user metadata
          setUserRole(data.session.user.user_metadata?.role || "free");
          // Check admin status
          if (data.session.user.user_metadata?.is_admin === true) {
            setUserRole("admin");
          }
        }
      } else {
        setUserRole("guest");
      }
    };
    checkUserRole();
  }, [isAuthenticated]);

  // Check for alerts (mock data for now)
  useEffect(() => {
    if (isAuthenticated) {
      // Simulated alerts - in a real app these would come from the database
      const dummyAlerts = [
        {
          id: 1,
          type: "edge",
          message: "New edge alert: KC Chiefs vs SF 49ers has a 7.5% edge",
          createdAt: new Date().toISOString(),
          isRead: false
        }, 
        {
          id: 2,
          type: "system",
          message: "New predictions available for NFL games",
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          isRead: false
        }, 
        {
          id: 3,
          type: "edge",
          message: "Edge opportunity increased: Lakers vs Warriors now at 5.2%",
          createdAt: new Date(Date.now() - 7200000).toISOString(),
          isRead: true
        }
      ];
      setAlerts(dummyAlerts);
      // Check if there are any unread alerts
      setHasNewAlerts(dummyAlerts.some(alert => !alert.isRead));
    }
  }, [isAuthenticated]);

  // Always display the Admin tab, access is controlled at the page level
  const showAdminTab = userRole === "admin";


  // Check if the user should see alerts (if they are authenticated)
  const shouldShowAlerts = isAuthenticated;
  
  return (
    <header className="w-full border-b py-3 sm:py-4">
      <div className="container flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden" 
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link to="/" className="flex items-center">
            <Logo size="md" />
          </Link>
          <div className="hidden md:flex items-center space-x-1">
            <HeaderNavLinks showAdminTab={showAdminTab} />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <ThemeToggle />
          
          {isAuthenticated ? (
            <>
              {shouldShowAlerts && (
                <NotificationsMenu 
                  alerts={alerts}
                  hasNewAlerts={hasNewAlerts}
                />
              )}
              
              <UserMenu showAdminTab={showAdminTab} />
            </>
          ) : (
            <>
              <Button 
                variant="ghost" 
                onClick={() => navigate("/auth/login")} 
                className="hidden md:inline-flex"
              >
                Sign in
              </Button>
              <Button onClick={() => navigate("/auth/register")}>
                Get Started
              </Button>
            </>
          )}
        </div>
      </div>
      
      <MobileNav 
        isOpen={mobileNavOpen} 
        onClose={() => setMobileNavOpen(false)} 
        isAuthenticated={isAuthenticated} 
        isAdmin={isAdmin} 
      />
    </header>
  );
}
