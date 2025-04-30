
import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t py-6 md:py-8">
      <div className="container flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-center md:text-left text-sm text-muted-foreground">
          © {new Date().getFullYear()} PlayEdge. All rights reserved. 
          <span className="block md:inline md:ml-2">
            Predictions are opinion only—no guarantees—gamble responsibly.
          </span>
        </p>
        <div className="flex items-center justify-center md:justify-end gap-4">
          <Link 
            to="/terms" 
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Terms
          </Link>
          <Link 
            to="/privacy" 
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Privacy
          </Link>
          <Link 
            to="/contact" 
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}
