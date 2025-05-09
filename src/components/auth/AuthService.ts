
import { supabase } from "@/integrations/supabase/client";

interface UserData {
  email: string;
  role: string;
  name: string;
  is_admin: boolean;
}

// Admin user credentials
const ADMIN_EMAIL = "tbreplogle@gmail.com";
// Hard-coded password for development purposes only - this should be removed in production
const ADMIN_PASSWORD = "1234"; 

// Demo user credentials
const DEMO_EMAIL = "6969@gmail.com";
const DEMO_PASSWORD = "6969";

export async function authenticateUser(
  email: string, 
  password: string, 
  rememberMe: boolean,
  type: "login" | "register"
): Promise<{ userData: UserData | null; error: Error | null }> {
  try {
    // Check for admin login
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      // In a development environment, simulate successful authentication
      // In production, this would be handled by Supabase authentication
      
      // Create admin user data
      const userData: UserData = {
        email: ADMIN_EMAIL,
        role: "admin",
        name: "Admin User",
        is_admin: true
      };
      
      if (rememberMe) {
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.setItem("rememberLogin", "true");
      } else {
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.removeItem("rememberLogin");
      }
      
      return { userData, error: null };
    }
    
    // Check for demo login
    if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
      // Create demo user data
      const userData: UserData = {
        email: DEMO_EMAIL,
        role: "premium",
        name: "Demo User",
        is_admin: false
      };
      
      if (rememberMe) {
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.setItem("rememberLogin", "true");
      } else {
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.removeItem("rememberLogin");
      }
      
      return { userData, error: null };
    }
    
    // Regular user authentication with Supabase
    if (type === "login") {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (loginError) {
        throw new Error(loginError.message);
      }
    } else {
      // Register new user
      const { error: signupError } = await supabase.auth.signUp({
        email,
        password
      });
      
      if (signupError) {
        throw new Error(signupError.message);
      }
    }
    
    // For demo purposes, allow any login with min requirements
    if (email.includes("@") && password.length >= 4) {
      // Create regular user data
      const userData: UserData = {
        email: email,
        role: "user",
        name: "User",
        is_admin: false
      };
      
      if (rememberMe) {
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.setItem("rememberLogin", "true");
      } else {
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.removeItem("rememberLogin");
      }
      
      return { userData, error: null };
    } else {
      throw new Error("Invalid credentials");
    }
  } catch (err) {
    return { 
      userData: null, 
      error: err instanceof Error ? err : new Error("Authentication failed. Please try again.") 
    };
  }
}

export async function authenticateWithGoogle(rememberMe: boolean): Promise<UserData> {
  // Simulate Google authentication
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const userData: UserData = {
    email: "google-user@example.com",
    role: "user",
    name: "Google User",
    is_admin: false
  };
  
  if (rememberMe) {
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("rememberLogin", "true");
  } else {
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.removeItem("rememberLogin");
  }
  
  return userData;
}
