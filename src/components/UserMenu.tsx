import { useNavigate } from "react-router-dom";
import { User, Settings } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  showAdminTab?: boolean;
}

export function UserMenu({ showAdminTab = true }: UserMenuProps) {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/auth/logout");
  };

  return (
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

        {showAdminTab && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-edge-secondary font-bold">
              Admin
            </DropdownMenuLabel>

            <DropdownMenuItem
              onClick={() => navigate("/admin/access-control")}
              className="bg-edge-secondary/10 text-edge-secondary hover:bg-edge-secondary/20"
            >
              Logic Lab
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => navigate("/admin/access-control")}
              className="bg-edge-secondary/10 text-edge-secondary hover:bg-edge-secondary/20"
            >
              Access Control
            </DropdownMenuItem>

            <DropdownMenuSeparator />
          </DropdownMenuGroup>
        )}

        <DropdownMenuItem onClick={handleLogout}>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
