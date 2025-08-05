import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
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
  isAdmin = false,
}: HeaderProps) {
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>("guest");
  const [alerts, setAlerts] = useState<any[]>([]);
  const [hasNewAlerts, setHasNewAlerts] = useState(false);

  useEffect(() => {
    const checkUserRole = async () => {
      if (!isAuthenticated) {
        setUserRole("guest");
        return;
      }
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (!session) {
        setUserRole("guest");
        return;
      }
      const meta = session.user.user_metadata || {};
      if (meta.is_admin === true) {
        setUserRole("admin");
      } else {
        setUserRole(meta.role || "free");
      }
    };
    checkUserRole();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const dummy = [{ id: 1, message: "New predictions available", isRead: false }];
    setAlerts(dummy);
    setHasNewAlerts(dummy.some((a) => !a.isRead));
  }, [isAuthenticated]);

  const showAdminTab = isAdmin || userRole === "admin";
  const showMembersTab = showAdminTab || userRole === "premium" || userRole === "enterprise";
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
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link to="/" className="flex items-center">
            <Logo size="md" />
          </Link>
          <div className="hidden md:flex items-center space-x-1">
            <HeaderNavLinks showAdminTab={showAdminTab} showMembersTab={showMembersTab} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              {shouldShowAlerts && <NotificationsMenu alerts={alerts} hasNewAlerts={hasNewAlerts} />}
              <UserMenu showAdminTab={showAdminTab} />
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate("/auth/login")} className="hidden md:inline-flex">Sign in</Button>
              <Button onClick={() => navigate("/auth/register")}>Get Started</Button>
            </>
          )}
        </div>
      </div>
      <MobileNav
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        isAuthenticated={isAuthenticated}
        isAdmin={showAdminTab}
      />
    </header>
  );
}
