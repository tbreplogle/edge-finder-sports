
import React from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MatchupTicker } from "@/components/MatchupTicker";

interface AppLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
  isAuthenticated?: boolean;
}

export function AppLayout({ children, showHeader = true, isAuthenticated = false }: AppLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen w-full max-w-[1600px] mx-auto px-2 sm:px-3 lg:px-4">
      {showHeader && <Header isAuthenticated={isAuthenticated} />}
      
      <MatchupTicker />
      
      <main className="flex-1 w-full">
        {children}
      </main>
      
      <Footer />
    </div>
  );
}
