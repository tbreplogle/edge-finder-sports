
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, ExternalLink, FileCode } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SportConfig {
  name: string;
  filePath: string;
  description: string;
}

const sportConfigs: Record<string, SportConfig> = {
  "ncaab-logic": {
    name: "NCAAB Logic",
    filePath: "api/src/formulas/ncaabPredict.ts",
    description: "College basketball prediction algorithm that considers factors like offensive efficiency, defensive efficiency, tempo, and strength of schedule."
  },
  "ncaaf-logic": {
    name: "NCAAF Logic",
    filePath: "api/src/formulas/ncaafPredict.ts",
    description: "College football prediction model that analyzes yards per play, turnover margin, special teams efficiency, and recruiting class rankings."
  },
  "nfl-logic": {
    name: "NFL Logic",
    filePath: "api/src/formulas/nflPredict.ts",
    description: "NFL game prediction algorithm considering advanced metrics like DVOA, EPA/play, injury adjustments, and home field advantage."
  },
  "mlb-logic": {
    name: "MLB Logic",
    filePath: "api/src/formulas/mlbPredict.ts",
    description: "Baseball game prediction model that factors in starting pitchers, bullpen strength, batting stats, and ballpark effects."
  }
};

// Mock GitHub repository URL for the "Edit in GitHub" link
const GITHUB_REPO_URL = "https://github.com/user/playedge";

const SportLogic = () => {
  const { sport } = useParams<{ sport: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [sourceCode, setSourceCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Check if the user is an admin
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      navigate("/auth/login");
      return;
    }
    
    try {
      const userData = JSON.parse(userStr);
      setUser(userData);
      
      // Redirect non-admin users
      if (!userData.is_admin) {
        navigate("/dashboard");
      }
    } catch (e) {
      console.error("Error parsing user data:", e);
      navigate("/auth/login");
    }
  }, [navigate]);
  
  // Get the sport configuration
  const config = sport ? sportConfigs[sport] : null;
  
  useEffect(() => {
    if (!config || !user?.is_admin) return;
    
    setLoading(true);
    
    // In a real app, this would be an API call to fetch the file from GitHub
    // Here we'll just use a mock source code
    setTimeout(() => {
      setSourceCode(`// ${config.name} Prediction Algorithm
// Path: ${config.filePath}

import { Game, PredictionOutput } from '../types';

/**
 * ${config.name} prediction function
 * @param game - The game data
 * @returns The prediction output with margin, confidence, and edge
 */
export function predict(game: Game): PredictionOutput {
  // Sample prediction logic - would be replaced with actual algorithm
  const homeAdvantage = 3.0;
  const homeOffenseRating = game.homeTeam.offenseRating || 0;
  const homeDefenseRating = game.homeTeam.defenseRating || 0;
  const awayOffenseRating = game.awayTeam.offenseRating || 0;
  const awayDefenseRating = game.awayTeam.defenseRating || 0;
  
  // Calculate raw prediction
  const homePrediction = homeOffenseRating - awayDefenseRating + homeAdvantage;
  const awayPrediction = awayOffenseRating - homeDefenseRating;
  const predictedMargin = homePrediction - awayPrediction;
  
  // Calculate market edge
  const edge = predictedMargin - game.marketSpread;
  
  // Calculate confidence based on data quality
  const confidence = Math.min(
    Math.round(65 + Math.abs(edge) * 3),
    95
  );
  
  return {
    predictedMargin,
    edge,
    confidence,
    rawFactors: {
      homeOffenseRating,
      homeDefenseRating,
      awayOffenseRating,
      awayDefenseRating,
      homeAdvantage
    }
  };
}`);
      setLoading(false);
    }, 1000);
  }, [config, user, navigate]);
  
  if (!config) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header isAuthenticated={true} />
        <main className="flex-1 container py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Sport logic configuration not found. Please select a valid sport.
            </AlertDescription>
          </Alert>
          <div className="flex justify-center mt-6">
            <Button onClick={() => navigate("/admin/sports/nfl-logic")}>
              Go to NFL Logic
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header isAuthenticated={true} />
      
      <main className="flex-1 container py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">{config.name}</h1>
            <p className="text-muted-foreground">
              {config.filePath}
            </p>
          </div>
          
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => window.open(`${GITHUB_REPO_URL}/blob/main/${config.filePath}`, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            <span>Edit in GitHub</span>
          </Button>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <p className="mb-6">{config.description}</p>
            
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin text-muted-foreground">○</div>
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              <div className="relative">
                <div className="absolute right-2 top-2">
                  <FileCode className="h-4 w-4 text-muted-foreground" />
                </div>
                <pre className="p-4 bg-muted rounded-md overflow-auto text-sm max-h-[600px]">
                  <code>{sourceCode}</code>
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
};

export default SportLogic;
