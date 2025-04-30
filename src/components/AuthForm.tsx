
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthFormFooter } from "@/components/auth/AuthFormFooter";
import { authenticateUser, authenticateWithGoogle } from "@/components/auth/AuthService";

interface AuthFormProps {
  type: "login" | "register";
  returnUrl?: string;
}

export function AuthForm({ type, returnUrl = "/dashboard" }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();
  
  console.log("AuthForm rendering with returnUrl:", returnUrl);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      const { userData, error } = await authenticateUser(email, password, rememberMe, type);
      
      if (error) {
        throw error;
      }
      
      // Show success toast
      toast.success(type === "login" ? "Login successful!" : "Account created successfully!");
      
      // Simulate authentication delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Navigate to the return URL or dashboard
      console.log("Login successful, navigating to:", returnUrl);
      navigate(returnUrl);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await authenticateWithGoogle(rememberMe);
      navigate(returnUrl);
    } catch (err) {
      setError("Google authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="w-full max-w-md">
      <div className="space-y-6">
        <LoginForm
          email={email}
          password={password}
          rememberMe={rememberMe}
          isLoading={isLoading}
          error={error}
          type={type}
          onEmailChange={(e) => setEmail(e.target.value)}
          onPasswordChange={(e) => setPassword(e.target.value)}
          onRememberMeChange={(checked) => setRememberMe(checked)}
          onSubmit={handleSubmit}
        />
        
        <AuthFormFooter
          type={type}
          returnUrl={returnUrl}
          onGoogleSignIn={handleGoogleSignIn}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
