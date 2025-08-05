import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "./Logo";
import { HeaderNavLinks } from "./HeaderNavLinks";
import { UserMenu } from "./UserMenu";
import { MobileNav } from "./MobileNav";
import { NotificationsMenu } from "./NotificationsMenu";

interface HeaderProps {
  isAuthenticated?: boolean;
}

export function Header({ isAuthenticated = false }: HeaderProps) {
  const navigate = useNavigate();
  const [role, setRole] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [hasNewAlerts, setHasNewAlerts] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const meta = data.session?.user.user_metadata;
      if (!meta) {
        setRole("guest");
        return;
      }
      if (meta.is_admin) setRole("admin");
      else setRole(meta.role || "free");
    })();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const dummy = [{ id: 1, message: "New predictions available", isRead: false }];
    setAlerts(dummy);
    setHasNewAlerts(dummy.some(a => !a.isRead));
  }, [isAuthenticated]);

  if (role === null) return null;

  const showAdminTab = role === "admin";
  const showMembersTab = showAdminTab || role === "premium" || role === "enterprise";

  return (
    <header className="w-full border-b py-3 sm:py-4">
      <div className="container flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
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
              <NotificationsMenu alerts={alerts} hasNewAlerts={hasNewAlerts} />
              <UserMenu showAdminTab={showAdminTab} />
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate("/auth/login")} className="hidden md:inline-flex">
                Sign in
              </Button>
              <Button onClick={() => navigate("/auth/register")}>Get Started</Button>
            </>
          )}
        </div>
      </div>

      <MobileNav
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        isAuthenticated={isAuthenticated}
        isAdmin={showAdminTab}
        showMembersTab={showMembersTab}
      />
    </header>
  );
}
