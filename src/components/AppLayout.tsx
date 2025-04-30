
import React from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MatchupTicker } from "@/components/MatchupTicker";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
  isAuthenticated?: boolean;
}

export function AppLayout({ children, showHeader = true, isAuthenticated = false }: AppLayoutProps) {
  const isMobile = useIsMobile();
  
  return (
    <div className="flex flex-col min-h-screen w-full">
      {showHeader && <Header isAuthenticated={isAuthenticated} />}
      
      <MatchupTicker />
      
      <main className="flex-1 w-full">
        <div className="w-full max-w-7xl 3xl:max-w-screen-3xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          {children}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
