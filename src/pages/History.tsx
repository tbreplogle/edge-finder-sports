import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Calendar, Download, Filter, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const History = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [year, setYear] = useState<string>("2025");
  const [sport, setSport] = useState<string>("mlb");
  const [team, setTeam] = useState<string>("");
  const [mockData, setMockData] = useState<any[]>([]);

  // Check user role/subscription
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      navigate("/auth/login");
      return;
    }
    try {
      const userData = JSON.parse(userStr);
      setIsAdmin(userData.is_admin === true);
      setIsPaid(userData.role === "premium" || userData.is_admin === true);
      if (!userData.is_admin && userData.role !== "premium") {
      navigate("/pricing");
      }
    } catch (e) {
      console.error(e);
    }
  }, [navigate]);

  // Generate mock data (replace with real API calls)
  useEffect(() => {
    const generateMockHistoricalData = () => {
      let teams: string[] = [];
      switch (sport) {
        case "mlb":
          teams = ["Yankees", "Red Sox", "Dodgers", "Cubs", "Astros", "Braves"];
          break;
        case "nfl":
          teams = ["Chiefs", "Eagles", "Cowboys", "Packers", "Bears", "Ravens", "49ers", "Bills"];
          break;
        case "ncaaf":
          teams = ["Crimson Tide", "Bulldogs", "Tigers", "Buckeyes", "Longhorns"];
          break;
        case "cbk":
          teams = ["Duke", "Tar Heels", "Jayhawks", "Bruins", "Wildcats"];
          break;
        default:
          teams = [];
      }
      const results = [];
      for (let i = 0; i < 10; i++) {
        const homeIndex = Math.floor(Math.random() * teams.length);
        let awayIndex = Math.floor(Math.random() * teams.length);
        while (awayIndex === homeIndex) {
          awayIndex = Math.floor(Math.random() * teams.length);
        }
        const homeTeam = teams[homeIndex];
        const awayTeam = teams[awayIndex];
        const marketSpread = Math.round((Math.random() * 14 - 7) * 2) / 2;
        const predictedMargin = Math.round((Math.random() * 16 - 8) * 10) / 10;
        const actualMargin = Math.round((Math.random() * 20 - 10) * 10) / 10;
        const edge = Math.round((predictedMargin - marketSpread) * 10) / 10;
        if (
          team &&
          !homeTeam.toLowerCase().includes(team.toLowerCase()) &&
          !awayTeam.toLowerCase().includes(team.toLowerCase())
        ) {
          continue;
        }
        results.push({
          id: `hist-${i}`,
          date: new Date(parseInt(year), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
          homeTeam,
          awayTeam,
          marketSpread,
          predictedMargin,
          actualMargin,
          edge,
          isPremium: edge > 2 || edge < -2,
        });
      }
      return results;
    };
    setMockData(generateMockHistoricalData());
  }, [team, year, sport]);

  const handleDownloadCSV = () => {
    alert("In a production app, this would download CSV data from the /api/history.csv endpoint");
  };

  const formatSpread = (value: number) => (value > 0 ? `+${value}` : value);

  if (!isPaid && !isAdmin) return null;

  return (
    <AppLayout isAuthenticated={true}>
      <div className="container py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Historical Predictions</h1>
            <p className="text-muted-foreground">Review past predictions and outcomes</p>
          </div>
          <Button variant="outline" className="flex items-center gap-2" onClick={handleDownloadCSV}>
            <Download className="h-4 w-4" />
            <span>Download CSV</span>
          </Button>
        </div>
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Sport</label>
                <Select value={sport} onValueChange={setSport}>
                  <SelectTrigger><SelectValue placeholder="Select sport" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mlb">MLB</SelectItem>
                    <SelectItem value="nfl">NFL</SelectItem>
                    <SelectItem value="cbk">CBK</SelectItem>
                    <SelectItem value="ncaaf">NCAAF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Season</label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Team Filter</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter by team name"
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <Button variant="secondary" className="flex items-center gap-2 w-full md:w-auto">
                  <Filter className="h-4 w-4" />
                  <span>Apply Filters</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Matchup</TableHead>
                <TableHead>Market Spread</TableHead>
                <TableHead>Predicted Margin</TableHead>
                <TableHead>Actual Margin</TableHead>
                <TableHead>Edge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockData.length > 0 ? (
                mockData.map((game) => {
                  const isBlurred = !isAdmin && game.isPremium;
                  return (
                    <TableRow key={game.id}>
                      <TableCell>{game.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</TableCell>
                      <TableCell>{game.awayTeam} @ {game.homeTeam}</TableCell>
                      <TableCell>{formatSpread(game.marketSpread)}</TableCell>
                      <TableCell className={isBlurred ? "premium-blur" : ""}>{formatSpread(game.predictedMargin)}</TableCell>
                      <TableCell>{formatSpread(game.actualMargin)}</TableCell>
                      <TableCell className={isBlurred ? "premium-blur" : ""}>
                        <span className={game.edge > 0 ? "text-edge-secondary" : "text-edge-accent"}>
                          {formatSpread(game.edge)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex flex-col items-center justify-center">
                      <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-medium text-lg mb-1">No historical data</h3>
                      <p className="text-muted-foreground">No historical predictions match your filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
};

export default History;
