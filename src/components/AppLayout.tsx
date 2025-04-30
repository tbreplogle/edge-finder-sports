
import React, { useEffect, useState } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MatchupTicker } from "@/components/MatchupTicker";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";

interface AppLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
  isAuthenticated?: boolean;
}

export function AppLayout({ children, showHeader = true, isAuthenticated = false }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    // Initialize from localStorage if available
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const userData = JSON.parse(userStr);
        return !!userData.is_admin;
      }
    } catch (e) {
      console.error("Error reading from localStorage:", e);
    }
    return false;
  });
  
  // Check if current route is home or dashboard to show the ticker
  const shouldShowTicker = location.pathname === "/" || location.pathname === "/dashboard";
  
  // Check for authentication status from localStorage if not provided
  const checkAuthentication = () => {
    if (isAuthenticated) return true;
    return !!localStorage.getItem("user");
  };
  
  // Check if user is admin
  useEffect(() => {
    let isMounted = true;
    
    const checkAdminStatus = async () => {
      try {
        // First check locally stored user data
        const userStr = localStorage.getItem("user");
        let localAdminStatus = false;
        
        if (userStr) {
          try {
            const userData = JSON.parse(userStr);
            localAdminStatus = !!userData.is_admin;
            if (isMounted && localAdminStatus) {
              console.log("Found admin status TRUE in localStorage");
              setIsAdmin(true);
            }
          } catch (e) {
            console.error("Error parsing user data:", e);
          }
        }
        
        // Then verify with Supabase regardless of local status
        const { data } = await supabase.auth.getSession();
        
        if (data.session && isMounted) {
          const user = data.session.user;
          const isAdminUser = user.user_metadata?.is_admin === true;
          console.log("User admin status from Supabase:", isAdminUser);
          
          if (isAdminUser) {
            setIsAdmin(true);
            
            // Update localStorage if needed
            if (userStr) {
              try {
                const userData = JSON.parse(userStr);
                if (!userData.is_admin) {
                  userData.is_admin = true;
                  localStorage.setItem("user", JSON.stringify(userData));
                  console.log("Updated localStorage with admin status");
                }
              } catch (e) {
                console.error("Error updating localStorage:", e);
              }
            }
          } else if (localAdminStatus !== isAdminUser) {
            // If Supabase says not admin but localStorage says admin, correct it
            setIsAdmin(false);
            if (userStr) {
              try {
                const userData = JSON.parse(userStr);
                userData.is_admin = false;
                localStorage.setItem("user", JSON.stringify(userData));
                console.log("Corrected localStorage admin status to false");
              } catch (e) {
                console.error("Error updating localStorage:", e);
              }
            }
          }
        } else if (isMounted) {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        if (isMounted) {
          toast.error("Failed to verify admin status");
        }
      }
    };
    
    checkAdminStatus();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        if (session?.user) {
          const isAdminUser = session.user.user_metadata?.is_admin === true;
          console.log("Auth state changed - user admin status:", isAdminUser);
          setIsAdmin(isAdminUser);
          
          // Update localStorage
          try {
            const userStr = localStorage.getItem("user");
            if (userStr) {
              const userData = JSON.parse(userStr);
              if (userData.is_admin !== isAdminUser) {
                userData.is_admin = isAdminUser;
                localStorage.setItem("user", JSON.stringify(userData));
                console.log("Updated localStorage admin status on auth change:", isAdminUser);
              }
            }
          } catch (e) {
            console.error("Error updating localStorage on auth change:", e);
          }
        } else {
          setIsAdmin(false);
          console.log("Auth state changed - user logged out or no session");
        }
      }
    );
    
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);
  
  console.log("AppLayout rendering with isAdmin status:", isAdmin);
  
  return (
    <div className="flex flex-col min-h-screen w-full">
      {showHeader && <Header isAuthenticated={checkAuthentication()} isAdmin={isAdmin} />}
      
      {shouldShowTicker && <MatchupTicker />}
      
      <main className="flex-1 w-full">
        <div className="w-full max-w-7xl 3xl:max-w-screen-3xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          {children}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
