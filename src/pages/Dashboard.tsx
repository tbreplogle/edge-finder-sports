
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SportTabs } from "@/components/SportTabs";
import { TabsContent } from "@/components/ui/tabs";
import { useState, useMemo } from "react";
import { GameCard, GameProps } from "@/components/GameCard";
import { PremiumBanner } from "@/components/PremiumBanner";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

const Dashboard = () => {
  const [sport, setSport] = useState<string>("nfl");
  // This would normally come from an API
  const mockGames: GameProps[] = useMemo(() => [
    {
      id: "nfl-1",
      sport: "nfl",
      homeTeam: "Chiefs",
      awayTeam: "Raiders",
      startTime: "2025-05-01T19:00:00",
      marketSpread: -7.5,
      predictedMargin: -9.2,
      edge: 1.7,
      confidence: 65,
      rawFactors: {
        home_offense_rank: 3,
        home_defense_rank: 8,
        away_offense_rank: 22,
        away_defense_rank: 14,
        home_field_advantage: 2.5,
        injuries_impact: -0.5
      }
    },
    {
      id: "nfl-2",
      sport: "nfl",
      homeTeam: "Eagles",
      awayTeam: "Cowboys",
      startTime: "2025-05-01T16:25:00",
      marketSpread: -3,
      predictedMargin: -6.5,
      edge: 3.5,
      confidence: 72,
      isPremium: true,
      rawFactors: {
        home_offense_rank: 5,
        home_defense_rank: 7,
        away_offense_rank: 2,
        away_defense_rank: 15,
        home_field_advantage: 2.5,
        injuries_impact: -0.2
      }
    },
    {
      id: "nfl-3",
      sport: "nfl",
      homeTeam: "Packers",
      awayTeam: "Bears",
      startTime: "2025-05-01T13:00:00",
      marketSpread: -6,
      predictedMargin: -4.2,
      edge: -1.8,
      confidence: 58,
      rawFactors: {
        home_offense_rank: 8,
        home_defense_rank: 12,
        away_offense_rank: 18,
        away_defense_rank: 10,
        home_field_advantage: 2.5,
        injuries_impact: -1.0
      }
    },
    {
      id: "ncaaf-1",
      sport: "ncaaf",
      homeTeam: "Georgia",
      awayTeam: "Alabama",
      startTime: "2025-05-01T15:30:00",
      marketSpread: -4.5,
      predictedMargin: -7.8,
      edge: 3.3,
      confidence: 68,
      isPremium: true,
      rawFactors: {
        home_offense_rank: 2,
        home_defense_rank: 1,
        away_offense_rank: 3,
        away_defense_rank: 5,
        home_field_advantage: 3.0,
        recruitment_class_diff: 0.5
      }
    },
    {
      id: "ncaaf-2",
      sport: "ncaaf",
      homeTeam: "Ohio State",
      awayTeam: "Michigan",
      startTime: "2025-05-01T12:00:00",
      marketSpread: -2.5,
      predictedMargin: -1.3,
      edge: -1.2,
      confidence: 55,
      isPremium: true,
      rawFactors: {
        home_offense_rank: 4,
        home_defense_rank: 6,
        away_offense_rank: 7,
        away_defense_rank: 2,
        home_field_advantage: 3.0,
        recruitment_class_diff: -0.2
      }
    },
    {
      id: "ncaab-1",
      sport: "ncaab",
      homeTeam: "Duke",
      awayTeam: "UNC",
      startTime: "2025-05-01T21:00:00",
      marketSpread: -3,
      predictedMargin: -6.2,
      edge: 3.2,
      confidence: 70,
      isPremium: true,
      rawFactors: {
        home_offense_efficiency: 118.5,
        home_defense_efficiency: 95.2,
        away_offense_efficiency: 115.8,
        away_defense_efficiency: 97.3,
        tempo_adjustment: 1.2
      }
    },
    {
      id: "mlb-1",
      sport: "mlb",
      homeTeam: "Dodgers",
      awayTeam: "Giants",
      startTime: "2025-05-01T19:10:00",
      marketSpread: -1.5,
      predictedMargin: -2.8,
      edge: 1.3,
      confidence: 63,
      isPremium: true,
      rawFactors: {
        home_starting_pitcher_era: 2.85,
        away_starting_pitcher_era: 3.75,
        home_batting_average: 0.265,
        away_batting_average: 0.248,
        ballpark_factor: 102
      }
    },
  ], []);
  
  const filteredGames = useMemo(() => {
    return mockGames.filter(game => game.sport === sport);
  }, [mockGames, sport]);
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header isAuthenticated={true} />
      
      <main className="flex-1 container py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Live Predictions Dashboard</h1>
            <p className="text-muted-foreground">
              Today's games with predicted margins and market edges
            </p>
          </div>
          
          <Button variant="outline" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>May 1, 2025</span>
          </Button>
        </div>
        
        <SportTabs activeTab={sport} onTabChange={setSport}>
          <TabsContent value="nfl" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGames.map(game => (
                <GameCard key={game.id} {...game} />
              ))}
            </div>
            {filteredGames.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No NFL games scheduled for today.</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="ncaaf" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGames.map(game => (
                <GameCard key={game.id} {...game} />
              ))}
            </div>
            {filteredGames.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No NCAAF games scheduled for today.</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="ncaab" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGames.map(game => (
                <GameCard key={game.id} {...game} />
              ))}
            </div>
            {filteredGames.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No NCAAB games scheduled for today.</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="mlb" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGames.map(game => (
                <GameCard key={game.id} {...game} />
              ))}
            </div>
            {filteredGames.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No MLB games scheduled for today.</p>
              </div>
            )}
          </TabsContent>
        </SportTabs>
        
        <PremiumBanner />
        
        <div className="mt-8 p-4 border rounded-lg bg-card">
          <h3 className="font-medium mb-2">Legend</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 bg-edge-nfl rounded-full"></div>
                <span className="text-sm font-medium">NFL</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-edge-ncaaf rounded-full"></div>
                <span className="text-sm font-medium">NCAAF</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 bg-edge-ncaab rounded-full"></div>
                <span className="text-sm font-medium">NCAAB</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-edge-mlb rounded-full"></div>
                <span className="text-sm font-medium">MLB</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <p>Data refreshed every 15 minutes during in-season periods.</p>
              <p>All times displayed in CT (America/Chicago).</p>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Dashboard;
