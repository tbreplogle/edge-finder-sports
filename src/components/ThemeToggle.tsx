
import { Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export function ThemeToggle() {
  useEffect(() => {
    // Always ensure dark mode is set
    document.documentElement.classList.remove("light");
    localStorage.setItem("theme", "dark");
  }, []);
  
  return (
    <Button variant="outline" size="icon" disabled>
      <Moon className="h-[1.2rem] w-[1.2rem]" />
      <span className="sr-only">Dark mode</span>
    </Button>
  );
}
