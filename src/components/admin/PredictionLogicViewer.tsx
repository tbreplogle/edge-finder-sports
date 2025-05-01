
import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Code, Download } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface PredictionLogicViewerProps {
  sport: string;
}

export function PredictionLogicViewer({ sport }: PredictionLogicViewerProps) {
  const [activeLogicTab, setActiveLogicTab] = useState<string>("js");
  const [jsCode, setJsCode] = useState<string>("");
  const [mlbLogic, setMlbLogic] = useState<string>("");
  const [isLoadingCode, setIsLoadingCode] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const normalizedSport = sport === "all" ? "mlb" : sport.toLowerCase();
  
  // Load the different code samples
  useEffect(() => {
    const loadLogicCode = async () => {
      setIsLoadingCode(true);
      setError(null);
      
      try {
        // Load the JavaScript code from workers/updatePredictions.js
        const jsResponse = await fetch("/workers/updatePredictions.js");
        if (!jsResponse.ok) {
          throw new Error("Failed to load JavaScript prediction logic");
        }
        const jsText = await jsResponse.text();
        setJsCode(jsText);
        
        // Load MLB-specific logic
        const mlbResponse = await fetch("/src/lib/formulas/mlbPredict.ts");
        if (!mlbResponse.ok) {
          throw new Error("Failed to load MLB prediction logic");
        }
        const mlbText = await mlbResponse.text();
        setMlbLogic(mlbText);
      } catch (err: any) {
        console.error("Error loading prediction logic code:", err);
        setError(err.message || "Failed to load prediction logic");
      } finally {
        setIsLoadingCode(false);
      }
    };
    
    loadLogicCode();
  }, []);

  // Get the appropriate code based on the selected sport and tab
  const getCodeForCurrentTab = () => {
    switch (activeLogicTab) {
      case "js":
        return jsCode;
      case "mlb":
        return mlbLogic;
      default:
        return "// No prediction logic available for this sport";
    }
  };
  
  // Function to export the code
  const exportCode = () => {
    try {
      const code = getCodeForCurrentTab();
      if (!code) return;
      
      const fileName = activeLogicTab === 'js' 
        ? 'prediction-logic.js' 
        : `${normalizedSport}-prediction-logic.ts`;
      
      // Create a blob with the code content
      const blob = new Blob([code], { type: 'text/plain' });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
    } catch (err) {
      console.error("Error exporting code:", err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Prediction Logic</h2>
        <Button
          variant="outline"
          onClick={exportCode}
          className="flex items-center gap-2"
          disabled={isLoadingCode || !!error}
        >
          <Download className="h-4 w-4" />
          Export Code
        </Button>
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Tabs
        defaultValue="js"
        value={activeLogicTab}
        onValueChange={setActiveLogicTab}
        className="w-full"
      >
        <TabsList className="mb-4">
          <TabsTrigger value="js">JavaScript Logic</TabsTrigger>
          <TabsTrigger value="mlb">MLB Logic</TabsTrigger>
        </TabsList>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <Code className="h-4 w-4 mr-2" />
              {activeLogicTab === 'js' 
                ? 'Main Prediction Logic (JavaScript)' 
                : `${normalizedSport.toUpperCase()} Prediction Logic`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingCode ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <Editor
                language={activeLogicTab === 'js' ? 'javascript' : 'typescript'}
                value={getCodeForCurrentTab()}
                height="500px"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  wordWrap: "on",
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                }}
              />
            )}
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
