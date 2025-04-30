
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
    <div className="flex flex-col min-h-screen">
      {showHeader && <Header isAuthenticated={isAuthenticated} />}
      
      <MatchupTicker />
      
      <main className="flex-1">
        {children}
      </main>
      
      <Footer />
    </div>
  );
}
