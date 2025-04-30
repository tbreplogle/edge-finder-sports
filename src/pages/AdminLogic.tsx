
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { SPORT_KEYS, SportKey } from "@/utils/config/sportKeys";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

const DEFAULT_CODE = `/**
 * Input: games[] from Odds-API for this sport
 * Output: array of { game_id, predicted_margin, predicted_total, confidence_pct }
 */
export default function predict(games) {
  return games.map(g => ({
    game_id: g.id,
    predicted_margin: 0,
    predicted_total: 0,
    confidence_pct: 55
  }));
}`;

const AdminLogic = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [sport, setSport] = useState<SportKey>("NFL");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Check if user is admin
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        // First check locally stored user data
        const userStr = localStorage.getItem("user");
        let localAdminStatus = false;
        
        if (userStr) {
          try {
            const userData = JSON.parse(userStr);
            localAdminStatus = !!userData.is_admin;
            console.log("AdminLogic - Local admin status:", localAdminStatus);
          } catch (e) {
            console.error("Error parsing user data:", e);
          }
        }
        
        // Then verify with Supabase session
        const { data } = await supabase.auth.getSession();
        
        if (data.session) {
          const user = data.session.user;
          const isAdminUser = user.user_metadata?.is_admin === true;
          console.log("AdminLogic - Supabase admin status:", isAdminUser);
          
          if (isAdminUser || localAdminStatus) {
            setIsAdmin(true);
          } else {
            // Not an admin, show toast and redirect
            toast.error("Access Denied", {
              description: "You need admin privileges to access this page."
            });
            navigate("/");
          }
        } else {
          // No session, redirect to login
          toast.error("Authentication Required", {
            description: "Please log in to continue."
          });
          navigate("/auth/login");
        }
      } catch (error) {
        console.error("Error verifying admin status:", error);
        toast.error("Authentication Error", {
          description: "Please try logging in again."
        });
        navigate("/auth/login");
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [navigate]);
  
  const runCode = async () => {
    setError(null);
    setRunning(true);
    
    try {
      const response = await supabase.functions.invoke('run-prediction-code', {
        body: { sport, code }
      });
      
      if (response.error) {
        throw new Error(response.error.message || "Failed to run code");
      }
      
      const result = response.data;
      
      if (result.error) {
        setError(result.error);
        toast.error("Error Running Code", {
          description: result.error
        });
      } else {
        toast.success("Success", {
          description: `Inserted ${result.inserted} predictions.`
        });
      }
    } catch (err: any) {
      console.error("Error running code:", err);
      setError(err.message || "An unexpected error occurred");
      toast.error("Error", {
        description: err.message || "Failed to run code"
      });
    } finally {
      setRunning(false);
    }
  };
  
  const sportOptions = Object.keys(SPORT_KEYS).map(key => ({
    label: key,
    value: key
  }));
  
  const handleSportChange = (value: string) => {
    setSport(value as SportKey);
  };
  
  if (isLoading) {
    return (
      <AppLayout>
        <div className="container py-12 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading admin panel...</p>
        </div>
      </AppLayout>
    );
  }
  
  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="container py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="mb-6">You need admin privileges to access this page.</p>
          <Button 
            onClick={() => navigate("/")}
            className="bg-edge-secondary hover:bg-edge-secondary/90"
          >
            Return to Home
          </Button>
        </div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout>
      <div className="container py-6">
        <h1 className="text-2xl font-bold mb-4">Admin Logic Lab</h1>
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Select value={sport} onValueChange={handleSportChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select Sport" />
              </SelectTrigger>
              <SelectContent>
                {sportOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              onClick={runCode}
              disabled={running}
              className="bg-edge-secondary hover:bg-edge-secondary/90"
            >
              {running ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                "Run & Publish"
              )}
            </Button>
          </div>
          
          <Button
            variant="outline"
            onClick={() => navigate("/dashboard")}
          >
            View Dashboard
          </Button>
        </div>
        
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap font-mono text-sm">
              {error}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="border rounded-lg overflow-hidden">
          <Editor
            language="typescript"
            value={code}
            onChange={(value) => setCode(value || "")}
            height="75vh"
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: "on",
            }}
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminLogic;
