import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Checkbox } from "@/components/ui/checkbox";

interface AuthFormProps {
  type: "login" | "register";
}

// Admin user credentials
const ADMIN_EMAIL = "tbreplogle@gmail.com";
const ADMIN_PASSWORD = "1234";

export function AuthForm({ type }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      // Check for admin login
      if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        // Store login state in localStorage with admin role
        const userData = {
          email: ADMIN_EMAIL,
          role: "admin",
          name: "Admin User",
          is_admin: true
        };
        
        if (rememberMe) {
          localStorage.setItem("user", JSON.stringify(userData));
          localStorage.setItem("rememberLogin", "true");
        } else {
          // If not "remember me", use sessionStorage instead which clears when browser is closed
          localStorage.setItem("user", JSON.stringify(userData));
          localStorage.removeItem("rememberLogin");
        }
        
        // Show success toast
        toast.success("Welcome back, Admin!");
        
        // Simulate authentication delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Navigate to dashboard
        navigate("/dashboard");
        return;
      }
      
      // For demo purposes, allow any login with min requirements
      if (email.includes("@") && password.length >= 4) {
        // Store basic user info
        const userData = {
          email: email,
          role: "user",
          name: "User",
          is_admin: false
        };
        
        if (rememberMe) {
          localStorage.setItem("user", JSON.stringify(userData));
          localStorage.setItem("rememberLogin", "true");
        } else {
          // If not "remember me", keep in localStorage but don't set the remember flag
          localStorage.setItem("user", JSON.stringify(userData));
          localStorage.removeItem("rememberLogin");
        }
        
        // Simulate authentication delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Navigate to dashboard
        navigate("/dashboard");
      } else {
        throw new Error("Invalid credentials");
      }
    } catch (err) {
      setError("Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="w-full max-w-md">
      <div className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">Email</Label>
            <Input 
              id="email"
              type="email" 
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="text-foreground"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">Password</Label>
            <Input 
              id="password"
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="text-foreground"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="rememberMe" 
              checked={rememberMe} 
              onCheckedChange={(checked) => setRememberMe(checked === true)}
            />
            <label
              htmlFor="rememberMe"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Remember me
            </label>
          </div>
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">○</span>
                {type === "login" ? "Signing In..." : "Creating Account..."}
              </span>
            ) : (
              <span>{type === "login" ? "Sign In" : "Create Account"}</span>
            )}
          </Button>
        </form>
        
        <div className="flex items-center justify-center gap-1 text-sm">
          <span className="text-muted-foreground">
            {type === "login" ? "Don't have an account?" : "Already have an account?"}
          </span>
          <Button 
            variant="link" 
            className="p-0 h-auto" 
            onClick={() => navigate(type === "login" ? "/auth/register" : "/auth/login")}
          >
            {type === "login" ? "Sign up" : "Sign in"}
          </Button>
        </div>
        
        {type === "login" && (
          <Button 
            variant="link" 
            className="p-0 h-auto w-full text-sm" 
            onClick={() => navigate("/auth/forgot-password")}
          >
            Forgot password?
          </Button>
        )}
        
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={() => {
            setIsLoading(true);
            setTimeout(() => {
              const userData = {
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
              
              navigate("/dashboard");
            }, 1000);
          }}
          disabled={isLoading}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" aria-hidden="true">
            <path
              d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z"
              fill="#EA4335"
            />
            <path
              d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.08L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z"
              fill="#4285F4"
            />
            <path
              d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z"
              fill="#FBBC05"
            />
            <path
              d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.075C15.0054 18.675 13.6204 19.0001 12.0004 19.0001C8.8704 19.0001 6.21537 16.92 5.2654 14.095L1.27539 17.19C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z"
              fill="#34A853"
            />
          </svg>
          Continue with Google
        </Button>
      </div>
    </div>
  );
}
