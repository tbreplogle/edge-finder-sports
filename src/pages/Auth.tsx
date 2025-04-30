
import { AuthForm } from "@/components/AuthForm";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";

const Auth = () => {
  const { action } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  // Extract return URL from location state if available
  const returnUrl = location.state?.returnUrl || "/dashboard";
  
  // Types: login, register, forgot-password, logout
  const validActions = ["login", "register", "forgot-password", "logout"];
  
  useEffect(() => {
    if (action === "logout") {
      // Check if "remember me" was set
      const rememberLogin = localStorage.getItem("rememberLogin");
      
      // Clear user data from local storage
      localStorage.removeItem("user");
      
      // Keep "rememberLogin" setting if it exists
      if (!rememberLogin) {
        localStorage.removeItem("rememberLogin");
      }
      
      // Show toast notification
      toast({
        title: "Logged out successfully",
        description: "You have been logged out of your account.",
      });
      
      // Redirect to home page
      navigate("/", { replace: true });
    }
  }, [action, navigate, toast]);
  
  if (!action || !validActions.includes(action)) {
    navigate("/auth/login");
    return null;
  }
  
  if (action === "logout") {
    return null; // Will be handled by the useEffect
  }
  
  return (
    <div className="flex flex-col min-h-screen">
      <header className="w-full py-4 px-4 border-b">
        <div className="container flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-lg font-bold text-edge-secondary">
            <span>PlayEdge</span>
          </a>
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")}
          >
            Back to home
          </Button>
        </div>
      </header>
      
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 bg-card rounded-lg shadow-md border">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-foreground">
              {action === "login" && "Sign In"}
              {action === "register" && "Create an Account"}
              {action === "forgot-password" && "Reset Password"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {action === "login" && "Sign in to access your account"}
              {action === "register" && "Create an account to get started"}
              {action === "forgot-password" && "Enter your email to reset your password"}
            </p>
          </div>
          
          {action === "forgot-password" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-foreground">
                  Email
                </label>
                <input 
                  type="email" 
                  id="email" 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                  placeholder="your@email.com"
                />
              </div>
              <Button className="w-full">Send Reset Instructions</Button>
              <div className="text-center">
                <Button 
                  variant="link" 
                  onClick={() => navigate("/auth/login")}
                  className="text-sm"
                >
                  Back to sign in
                </Button>
              </div>
            </div>
          ) : (
            <AuthForm type={action === "login" ? "login" : "register"} returnUrl={returnUrl} />
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Auth;
