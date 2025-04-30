
import React, { useEffect, useState } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MatchupTicker } from "@/components/MatchupTicker";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
      try {
        // First check locally stored user data
        const userStr = localStorage.getItem("user");
        if (userStr) {
          const userData = JSON.parse(userStr);
          if (userData.is_admin) {
            console.log("Found admin status in localStorage");
            setIsAdmin(true);
            return;
          }
        }
        
        // Then check with Supabase
        const { data } = await supabase.auth.getSession();
        
        if (data.session) {
          const user = data.session.user;
          const isAdminUser = user.user_metadata?.is_admin === true;
          console.log("User admin status from Supabase:", isAdminUser);
          setIsAdmin(isAdminUser);
          
          // Update localStorage if needed
          if (isAdminUser && userStr) {
            try {
              const userData = JSON.parse(userStr);
              if (!userData.is_admin) {
                userData.is_admin = true;
                localStorage.setItem("user", JSON.stringify(userData));
              }
            } catch (e) {
              console.error("Error updating localStorage:", e);
            }
          }
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        toast.error("Failed to verify admin status");
      }
    };
    
    checkAdminStatus();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          const isAdminUser = session.user.user_metadata?.is_admin === true;
          console.log("Auth state changed - user admin status:", isAdminUser);
          setIsAdmin(isAdminUser);
        } else {
          setIsAdmin(false);
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  console.log("AppLayout isAdmin status:", isAdmin);
  
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
