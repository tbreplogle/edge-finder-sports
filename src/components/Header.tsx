
import { Bell, Menu, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
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
import { Link } from "react-router-dom";

interface HeaderProps {
  isAuthenticated?: boolean;
  isAdmin?: boolean;
}

export function Header({ isAuthenticated = false, isAdmin = false }: HeaderProps) {
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  
  const handleLogout = () => {
    navigate("/auth/logout");
  };

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
          <a 
            href="/"
            className="flex items-center gap-2 text-lg md:text-xl font-bold text-edge-secondary"
          >
            <span className="hidden md:inline">Play</span>
            <span>Edge</span>
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
              {isAdmin && (
                <Link to="/admin/logic" className="px-3 py-2 text-sm font-medium text-edge-secondary hover:text-edge-secondary/80">
                  Logic Lab
                </Link>
              )}
            </nav>
          </div>
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
                      <DropdownMenuItem onClick={() => navigate("/admin/logic")}>
                        Logic Lab
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </DropdownMenuGroup>
                  )}
                  <DropdownMenuItem onClick={handleLogout}>
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
