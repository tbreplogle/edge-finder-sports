
import { useState } from "react";
import { FormInput } from "@/components/auth/FormInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface LoginFormProps {
  email: string;
  password: string;
  rememberMe: boolean;
  isLoading: boolean;
  error: string | null;
  type: "login" | "register";
  onEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRememberMeChange: (checked: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function LoginForm({
  email,
  password,
  rememberMe,
  isLoading,
  error,
  type,
  onEmailChange,
  onPasswordChange,
  onRememberMeChange,
  onSubmit
}: LoginFormProps) {
  return (
    <>
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <form onSubmit={onSubmit} className="space-y-4">
        <FormInput
          id="email"
          label="Email"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={onEmailChange}
          required
        />
        
        <FormInput
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={onPasswordChange}
          required
        />
        
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="rememberMe" 
            checked={rememberMe} 
            onCheckedChange={(checked) => onRememberMeChange(checked === true)}
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
    </>
  );
}
