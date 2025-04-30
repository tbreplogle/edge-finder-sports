
import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, ShieldAlert } from "lucide-react";

const SportLogicTemplate = () => {
  const { sport } = useParams<{ sport: string }>();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sourceCode, setSourceCode] = useState("");
  
  // Formatted sport name for display
  const formattedSport = sport?.replace('-logic', '').toUpperCase() || "";
  
  // GitHub repo information - in a real app, this would be configured properly
  const githubRepo = "playedge/formula-engine";
  const githubBranch = "main";
  const githubFilePath = `api/src/formulas/${formattedSport.toLowerCase()}Predict.ts`;
  
  // Check if user is admin
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      navigate("/auth/login");
      return;
    }
    
    try {
      const user = JSON.parse(userStr);
      setIsAdmin(user.is_admin === true);
      
      if (!user.is_admin) {
        navigate("/dashboard");
      }
    } catch (e) {
      console.error("Error parsing user data:", e);
      navigate("/dashboard");
    }
  }, [navigate]);
  
  // Mock loading source code - in a real app, this would fetch from GitHub API
  useEffect(() => {
    if (!isAdmin) return;
    
    // Simulate API call delay
    const timer = setTimeout(() => {
      const mockSourceCode = `
// ${formattedSport} Prediction Logic
// Last updated: ${new Date().toLocaleString()}

import { Game, PredictionInput, PredictionOutput } from '../types';

/**
 * Calculates predicted margin and edge for ${formattedSport} games
 * @param game Game data with teams and odds
 * @param factors Additional factors like injuries, weather, etc.
 * @returns Prediction with expected margin and confidence
 */
export function predict${formattedSport}(
  game: Game,
  factors: PredictionInput
): PredictionOutput {
  // Home team advantage (points)
  const homeAdvantage = 2.5;
  
  // Power rankings adjustment
  const powerRankingDiff = factors.homeTeamRank - factors.awayTeamRank;
  
  // Calculate predicted margin
  let predictedMargin = homeAdvantage + (powerRankingDiff * 0.5);
  
  // Injury adjustments
  if (factors.homeInjuryImpact) {
    predictedMargin -= factors.homeInjuryImpact;
  }
  if (factors.awayInjuryImpact) {
    predictedMargin += factors.awayInjuryImpact;
  }
  
  // Market spread is negative when home team is favored
  const edge = predictedMargin - game.marketSpread;
  
  // Calculate confidence based on model certainty
  const confidence = Math.min(95, 50 + Math.abs(edge) * 5);
  
  return {
    predictedMargin,
    edge,
    confidence,
    factors: {
      homeAdvantage,
      powerRankingDiff,
      injuries: factors.homeInjuryImpact - factors.awayInjuryImpact
    }
  };
}
      `;
      
      setSourceCode(mockSourceCode);
      setLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [isAdmin, formattedSport]);
  
  if (!isAdmin) {
    return null; // Redirect happens in useEffect
  }
  
  // Calculate GitHub URL for the "Edit in GitHub" link
  const githubEditUrl = `https://github.com/${githubRepo}/blob/${githubBranch}/${githubFilePath}`;
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header isAuthenticated={true} />
      
      <main className="flex-1 container py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">{formattedSport} Prediction Logic</h1>
            <p className="text-muted-foreground">
              View and manage the algorithm used for {formattedSport} predictions
            </p>
          </div>
          
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={() => window.open(githubEditUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            <span>Edit in GitHub</span>
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Source Code</span>
              <div className="px-2 py-1 bg-amber-500/10 text-amber-500 text-xs rounded-md flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" />
                <span>Admin Only</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <pre className="bg-muted p-4 rounded-md overflow-auto max-h-[500px] text-sm">
                {sourceCode}
              </pre>
            )}
          </CardContent>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
};

export default SportLogicTemplate;
