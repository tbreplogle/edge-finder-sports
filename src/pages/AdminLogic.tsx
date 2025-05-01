import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { SPORT_KEYS, SportKey } from "@/utils/config/sportKeys";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Download, Code, Eye, Database } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Move default code templates to separate constants
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

const DEFAULT_R_CODE = `#' @param games List of game objects from Odds-API for this sport
#' @return List of predictions with game_id, predicted_margin, predicted_total, confidence_pct
predict <- function(games) {
  # Create empty list to store predictions
  predictions <- list()
  
  # Loop through each game and create a prediction
  for (i in 1:length(games)) {
    game <- games[[i]]
    prediction <- list(
      game_id = game$id,
      predicted_margin = 0,
      predicted_total = 0,
      confidence_pct = 55
    )
    predictions[[i]] <- prediction
  }
  
  return(predictions)
}`;

const DEFAULT_PYTHON_CODE = `# Input: games[] from Odds-API for this sport
# Output: array of { game_id, predicted_margin, predicted_total, confidence_pct }
def predict(games):
    predictions = []
    for game in games:
        predictions.append({
            "game_id": game["id"],
            "predicted_margin": 0,
            "predicted_total": 0,
            "confidence_pct": 55
        })
    return predictions`;

type LanguageType = "typescript" | "r" | "python";

interface Prediction {
  game_id: string;
  predicted_margin: number;
  predicted_total: number;
  confidence_pct: number;
}

const AdminLogic = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [sport, setSport] = useState<SportKey>("NFL");
  const [running, setRunning] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [language, setLanguage] = useState<LanguageType>("typescript");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<Prediction[]>([]);
  const [gamesCount, setGamesCount] = useState(0);
  const [authToken, setAuthToken] = useState<string | null>(null);
  
  // Check if user is admin
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        console.log("AdminLogic - Starting authentication check");
        
        // First check locally stored user data
        const userStr = localStorage.getItem("user");
        let localAdminStatus = false;
        
        if (userStr) {
          try {
            const userData = JSON.parse(userStr);
            localAdminStatus = !!userData.is_admin;
            console.log("AdminLogic - Local admin status:", localAdminStatus);
            
            // Set admin status from localStorage immediately to prevent flicker
            if (localAdminStatus) {
              setIsAdmin(true);
            }
          } catch (e) {
            console.error("Error parsing user data:", e);
          }
        }
        
        // Get session token for API calls - needed for admin verification
        const { data } = await supabase.auth.getSession();
        
        if (data.session) {
          // Store the session token for API calls
          setAuthToken(data.session.access_token);
          
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
        } else if (!localAdminStatus) {
          // No session and no local admin status, redirect to login
          console.log("AdminLogic - No session found, redirecting to login");
          toast.error("Authentication Required", {
            description: "Please log in to continue."
          });
          navigate("/auth/login", { state: { returnUrl: "/admin/logic" } });
        }
      } catch (error) {
        console.error("Error verifying admin status:", error);
        if (!isAdmin) {
          toast.error("Authentication Error", {
            description: "Please try logging in again."
          });
          navigate("/auth/login", { state: { returnUrl: "/admin/logic" } });
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [navigate]);
  
  // Set default code based on selected language
  useEffect(() => {
    if (language === "r") {
      setCode(DEFAULT_R_CODE);
    } else if (language === "python") {
      setCode(DEFAULT_PYTHON_CODE);
    } else {
      setCode(DEFAULT_CODE);
    }
  }, [language]);
  
  const runCode = async (previewOnly = false) => {
    setError(null);
    if (previewOnly) {
      setPreviewing(true);
    } else {
      setRunning(true);
    }
    
    try {
      // Only for development/demo - in production, remove this bypass
      const effectiveToken = authToken || "BYPASS_AUTH_FOR_DEVELOPMENT";
      
      console.log("Calling run-prediction-code function with auth token");
      
      const response = await supabase.functions.invoke('run-prediction-code', {
        body: { sport, code, language, previewOnly },
        headers: {
          Authorization: `Bearer ${effectiveToken}`
        }
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
      } else if (previewOnly && result.preview) {
        // Handle preview data
        setPreviewData(result.predictions);
        setGamesCount(result.gamesCount);
        setPreviewOpen(true);
        toast.success("Preview Ready", {
          description: `Generated ${result.predictions.length} predictions.`
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
      setPreviewing(false);
    }
  };
  
  const previewCode = async () => {
    await runCode(true);
  };
  
  // Export code as a downloadable file
  const exportCode = () => {
    try {
      // Get file extension based on language
      const fileExtension = language === "typescript" ? "js" : 
                            language === "r" ? "R" : 
                            language === "python" ? "py" : "txt";
      
      // Create appropriate file headers based on language
      const headerComment = language === "typescript" ? 
        `// PlayEdge Sport Prediction Logic for ${sport}\n// Exported on ${new Date().toLocaleString()}\n\n` :
        language === "r" ? 
        `# PlayEdge Sport Prediction Logic for ${sport}\n# Exported on ${new Date().toLocaleString()}\n\n` :
        `# PlayEdge Sport Prediction Logic for ${sport}\n# Exported on ${new Date().toLocaleString()}\n\n`;
        
      // Create example usage based on language  
      const exampleUsage = language === "typescript" ? 
        `\n\n// Example usage:\n// const games = [{ id: "123", home_team: "Team A", away_team: "Team B", ... }];\n// const predictions = predict(games);\n// console.log(predictions);` :
        language === "r" ? 
        `\n\n# Example usage:\n# games <- list(list(id="123", home_team="Team A", away_team="Team B"))\n# predictions <- predict(games)\n# print(predictions)` :
        `\n\n# Example usage:\n# games = [{"id": "123", "home_team": "Team A", "away_team": "Team B"}]\n# predictions = predict(games)\n# print(predictions)`;
      
      // Create a blob with the code content
      const blob = new Blob([
        headerComment,
        code,
        exampleUsage,
      ], { type: 'text/plain' });
      
      // Create an element to trigger the download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `playedge-${sport.toLowerCase()}-prediction.${fileExtension}`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
      
      toast.success("Code Exported", {
        description: `${sport} prediction code has been exported successfully.`
      });
    } catch (err: any) {
      console.error("Error exporting code:", err);
      toast.error("Export Failed", {
        description: err.message || "Failed to export code"
      });
    }
  };
  
  const sportOptions = Object.keys(SPORT_KEYS).map(key => ({
    label: key,
    value: key
  }));
  
  const handleSportChange = (value: string) => {
    setSport(value as SportKey);
  };
  
  const handleLanguageChange = (value: LanguageType) => {
    setLanguage(value);
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
        
        {/* Language selector */}
        <div className="mb-4">
          <div className="flex flex-col gap-2 mb-4">
            <Label>Programming Language</Label>
            <RadioGroup 
              className="flex gap-4" 
              value={language} 
              onValueChange={(value) => handleLanguageChange(value as LanguageType)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="typescript" id="lang-typescript" />
                <Label htmlFor="lang-typescript">JavaScript/TypeScript</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="r" id="lang-r" />
                <Label htmlFor="lang-r">R</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="python" id="lang-python" />
                <Label htmlFor="lang-python">Python</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        
        {/* Sport selector and action buttons */}
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
              onClick={() => runCode(true)}
              disabled={running || previewing}
              variant="outline"
              className="flex items-center gap-2"
            >
              {previewing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Previewing...
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Run & Preview
                </>
              )}
            </Button>
            
            <Button
              onClick={() => runCode(false)}
              disabled={running || previewing}
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

            <Button
              onClick={exportCode}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export Code
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => navigate("/admin/preview")}
            >
              <Database className="h-4 w-4" />
              Preview Data
            </Button>
            
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
            >
              View Dashboard
            </Button>
          </div>
        </div>
        
        {/* Error display */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap font-mono text-sm">
              {error}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Code editor */}
        <div className="border rounded-lg overflow-hidden">
          <Editor
            language={language === "typescript" ? "typescript" : language === "r" ? "r" : "python"}
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
        
        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Prediction Preview</DialogTitle>
              <DialogDescription>
                Preview of {previewData.length} predictions (from {gamesCount} games)
              </DialogDescription>
            </DialogHeader>
            
            <div className="mt-4">
              {previewData.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left">#</th>
                        <th className="px-4 py-2 text-left">Game ID</th>
                        <th className="px-4 py-2 text-right">Margin</th>
                        <th className="px-4 py-2 text-right">Total</th>
                        <th className="px-4 py-2 text-right">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.slice(0, 20).map((pred, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-4 py-2">{idx + 1}</td>
                          <td className="px-4 py-2 font-mono text-xs">{pred.game_id}</td>
                          <td className="px-4 py-2 text-right">{pred.predicted_margin.toFixed(1)}</td>
                          <td className="px-4 py-2 text-right">{pred.predicted_total.toFixed(1)}</td>
                          <td className="px-4 py-2 text-right">{pred.confidence_pct.toFixed(0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {previewData.length > 20 && (
                    <div className="py-3 px-4 text-center text-sm text-muted-foreground border-t">
                      Showing 20 of {previewData.length} predictions
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No predictions generated
                </div>
              )}
              
              <div className="flex justify-end mt-4 gap-4">
                <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                  Close
                </Button>
                <Button 
                  disabled={running}
                  onClick={() => {
                    setPreviewOpen(false);
                    runCode(false);
                  }}
                  className="bg-edge-secondary hover:bg-edge-secondary/90"
                >
                  Publish These Predictions
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default AdminLogic;
