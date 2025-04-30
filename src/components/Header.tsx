import { Bell, Menu, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { MobileNav } from "./MobileNav";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle } from "@/components/ui/navigation-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
interface HeaderProps {
  isAuthenticated?: boolean;
  isAdmin?: boolean;
}
export function Header({
  isAuthenticated = false,
  isAdmin = false
}: HeaderProps) {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>("guest");
  const [alerts, setAlerts] = useState<any[]>([]);
  const [hasNewAlerts, setHasNewAlerts] = useState(false);

  // Get user role
  useEffect(() => {
    const checkUserRole = async () => {
      if (isAuthenticated) {
        const {
          data
        } = await supabase.auth.getSession();
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
      const dummyAlerts = [{
        id: 1,
        type: "edge",
        message: "New edge alert: KC Chiefs vs SF 49ers has a 7.5% edge",
        createdAt: new Date().toISOString(),
        isRead: false
      }, {
        id: 2,
        type: "system",
        message: "New predictions available for NFL games",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        isRead: false
      }, {
        id: 3,
        type: "edge",
        message: "Edge opportunity increased: Lakers vs Warriors now at 5.2%",
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        isRead: true
      }];
      setAlerts(dummyAlerts);
      // Check if there are any unread alerts
      setHasNewAlerts(dummyAlerts.some(alert => !alert.isRead));
    }
  }, [isAuthenticated]);
  const handleLogout = () => {
    navigate("/auth/logout");
  };
  const markAlertsAsRead = () => {
    setAlerts(alerts.map(alert => ({
      ...alert,
      isRead: true
    })));
    setHasNewAlerts(false);

    // In a real app, you would also update the database
    toast({
      title: "Alerts marked as read",
      description: "All notifications have been marked as read"
    });
  };

  // Always display the Admin tab, access is controlled at the page level
  const showAdminTab = true;

  // Check if the user should see alerts (if they are authenticated)
  const shouldShowAlerts = isAuthenticated;
  return <header className="w-full border-b py-3 sm:py-4">
      <div className="container flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileNavOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <a href="/" className="flex items-center gap-2 text-lg md:text-xl font-bold text-edge-secondary">
            <span className="hidden md:inline">Game</span>
            <span>Intel</span>
          </a>
          <div className="hidden md:flex items-center space-x-1">
            <nav className="flex items-center space-x-1">
              <Link to="/dashboard" className="px-3 py-2 text-sm font-medium hover:text-foreground/80">
                Dashboard
              </Link>
              <Link to="/history" className="px-3 py-2 text-sm font-medium hover:text-foreground/80">
                History
              </Link>
              <Link to="/pricing" className="px-3 py-2 text-sm font-medium hover:text-foreground/80">
                Pricing
              </Link>
              
              {showAdminTab && <Link to="/admin/logic" className="px-3 py-2 text-sm font-medium bg-edge-secondary/10 text-edge-secondary rounded-md hover:bg-edge-secondary/20">
                  Admin: Logic Lab
                </Link>}
            </nav>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <ThemeToggle />
          
          {isAuthenticated ? <>
              {shouldShowAlerts && <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                      <Bell className="h-5 w-5" />
                      {hasNewAlerts && <span className="absolute top-1 right-1 w-2 h-2 bg-edge-accent rounded-full"></span>}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="sm:max-w-[425px]">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex justify-between items-center">
                        Notifications
                        <Button variant="ghost" size="sm" onClick={markAlertsAsRead}>
                          Mark all as read
                        </Button>
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {alerts.length > 0 ? <div className="max-h-[300px] overflow-auto">
                            {alerts.map(alert => <div key={alert.id} className={`alert-notification-item ${!alert.isRead ? 'unread' : ''}`}>
                                <div className="flex justify-between">
                                  <span className={`alert-badge ${alert.type}`}>
                                    {alert.type === 'edge' ? 'Edge Alert' : 'System'}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(alert.createdAt).toLocaleTimeString()}
                                  </span>
                                </div>
                                <p className="mt-2 text-sm">{alert.message}</p>
                              </div>)}
                          </div> : <p className="py-8 text-center">No notifications to display</p>}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Close</AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/account")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Account Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {showAdminTab && <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-edge-secondary font-bold">Admin</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => navigate("/admin/logic")} className="bg-edge-secondary/10 text-edge-secondary hover:bg-edge-secondary/20">
                        Logic Lab
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </DropdownMenuGroup>}
                  <DropdownMenuItem onClick={handleLogout}>
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </> : <>
              <Button variant="ghost" onClick={() => navigate("/auth/login")} className="hidden md:inline-flex">
                Sign in
              </Button>
              <Button onClick={() => navigate("/auth/register")}>
                Get Started
              </Button>
            </>}
        </div>
      </div>
      
      <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} isAuthenticated={isAuthenticated} isAdmin={isAdmin} />
    </header>;
}