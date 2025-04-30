
import React, { useEffect, useState } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MatchupTicker } from "@/components/MatchupTicker";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";

interface AppLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
  isAuthenticated?: boolean;
}

export function AppLayout({ children, showHeader = true, isAuthenticated = false }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Check for authentication status from localStorage if not provided
  const checkAuthentication = () => {
    if (isAuthenticated) return true;
    return !!localStorage.getItem("user");
  };
  
  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data } = await supabase.auth.getSession();
      
      if (data.session) {
        const user = data.session.user;
        setIsAdmin(user.user_metadata?.is_admin === true);
      } else {
        setIsAdmin(false);
      }
    };
    
    checkAdminStatus();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setIsAdmin(session.user.user_metadata?.is_admin === true);
        } else {
          setIsAdmin(false);
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  return (
    <div className="flex flex-col min-h-screen w-full">
      {showHeader && <Header isAuthenticated={checkAuthentication()} isAdmin={isAdmin} />}
      
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
