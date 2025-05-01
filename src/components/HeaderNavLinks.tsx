
import { Link } from "react-router-dom";

interface HeaderNavLinksProps {
  showAdminTab?: boolean;
}

export function HeaderNavLinks({ showAdminTab = true }: HeaderNavLinksProps) {
  return (
    <nav className="flex items-center space-x-1">
      <Link to="/dashboard" className="px-3 py-2 text-sm font-medium hover:text-foreground/80">
        Dashboard
      </Link>
      <Link to="/line-tracker" className="px-3 py-2 text-sm font-medium hover:text-foreground/80">
        Line Tracker
      </Link>
      <Link to="/history" className="px-3 py-2 text-sm font-medium hover:text-foreground/80">
        History
      </Link>
      <Link to="/pricing" className="px-3 py-2 text-sm font-medium hover:text-foreground/80">
        Pricing
      </Link>
      
      {showAdminTab && (
        <Link 
          to="/admin/logic" 
          className="px-3 py-2 text-sm font-medium bg-edge-secondary/10 text-edge-secondary rounded-md hover:bg-edge-secondary/20"
        >
          Admin: Logic Lab
        </Link>
      )}
    </nav>
  );
}
