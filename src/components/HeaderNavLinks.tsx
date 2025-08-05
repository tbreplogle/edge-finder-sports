import { Link } from "react-router-dom";

interface HeaderNavLinksProps {
  showAdminTab?: boolean;
  showMembersTab?: boolean;
}

export function HeaderNavLinks({
  showAdminTab = false,
  showMembersTab = false,
}: HeaderNavLinksProps) {
  return (
    <nav className="flex items-center space-x-1">
      <Link to="/dashboard" className="px-3 py-2 text-sm font-medium hover:text-foreground/80">Dashboard</Link>
      <Link to="/history" className="px-3 py-2 text-sm font-medium hover:text-foreground/80">History</Link>
      <Link to="/injuries" className="px-3 py-2 text-sm font-medium hover:text-foreground/80">Injuries</Link>
      <Link to="/pricing" className="px-3 py-2 text-sm font-medium hover:text-foreground/80">Pricing</Link>
      {showMembersTab && (
        <Link to="/members" className="md:px-3 md:py-2 hover:text-primary transition-colors">Picks</Link>
      )}
      {showAdminTab && (
        <Link to="/admin/dashboard" className="md:px-3 md:py-2 hover:text-primary transition-colors">Admin</Link>
      )}
    </nav>
  );
}
