
import { Bell, Menu, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { MobileNav } from "./MobileNav";

export function Header({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    if (isAuthenticated) {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          setIsAdmin(user.is_admin === true);
        } catch (e) {
          console.error("Error parsing user data:", e);
        }
      }
    }
  }, [isAuthenticated]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2 md:gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden" 
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <a 
            href="/"
            className="flex items-center gap-2 text-lg md:text-xl font-bold text-edge-secondary"
          >
            <span className="hidden md:inline">Play</span>
            <span>Edge</span>
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a 
              href="/dashboard"
              className="text-foreground/70 transition-colors hover:text-foreground"
            >
              Dashboard
            </a>
            <a 
              href="/history"
              className="text-foreground/70 transition-colors hover:text-foreground"
            >
              History
            </a>
            <a 
              href="/pricing"
              className="text-foreground/70 transition-colors hover:text-foreground"
            >
              Pricing
            </a>
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-foreground/70 transition-colors hover:text-foreground">
                    Admin
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Admin Tools</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Sport Logic</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => navigate("/admin/sports/nfl-logic")}>
                        NFL
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/admin/sports/ncaaf-logic")}>
                        NCAAF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/admin/sports/ncaab-logic")}>
                        NCAAB
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/admin/sports/mlb-logic")}>
                        MLB
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>
        </div>
        
        <div className="flex items-center gap-2">
          <ThemeToggle />
          
          {isAuthenticated ? (
            <>
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>
              
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
                  {isAdmin && (
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Admin</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => navigate("/admin/sports/nfl-logic")}>
                        NFL Logic
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/admin/sports/ncaaf-logic")}>
                        NCAAF Logic
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/admin/sports/ncaab-logic")}>
                        NCAAB Logic
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/admin/sports/mlb-logic")}>
                        MLB Logic
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </DropdownMenuGroup>
                  )}
                  <DropdownMenuItem onClick={() => {
                    localStorage.removeItem("user");
                    navigate("/auth/logout");
                  }}>
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
              <Button 
                onClick={() => navigate("/auth/register")}
              >
                Get Started
              </Button>
            </>
          )}
        </div>
      </div>
      
      <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} isAuthenticated={isAuthenticated} />
    </header>
  );
}
