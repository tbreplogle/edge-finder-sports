import { useState } from "react";
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
import { useMlbHistory } from "@/hooks/useMlbHistory";

const History = () => {
  const [year, setYear] = useState<string>("2025");
  const [sport, setSport] = useState<string>("mlb");
  const [team, setTeam] = useState<string>("");

  const { data: history = [], isLoading } = useMlbHistory(year);

  const filtered = history.filter((g: any) => {
    if (!team) return true;
    const t = team.toLowerCase();
    return (
      g.home_team?.toLowerCase().includes(t) ||
      g.away_team?.toLowerCase().includes(t)
    );
  });

  if (sport !== "mlb") {
    return (
      <AppLayout isAuthenticated={true}>
        <div className="container py-8">
          <h1 className="text-2xl md:text-3xl font-bold">Historical Predictions</h1>
          <p>No history yet for {sport.toUpperCase()}.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout isAuthenticated={true}>
      <div className="container py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Historical Predictions</h1>
            <p className="text-muted-foreground">Review past MLB predictions and outcomes</p>
          </div>
          <Button variant="outline" className="flex items-center gap-2" onClick={() => {}}>
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading…</TableCell>
                </TableRow>
              ) : filtered.length > 0 ? (
                filtered.map((g: any) => (
                  <TableRow key={g.id}>
                    <TableCell>{new Date(g.game_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</TableCell>
                    <TableCell>{g.away_team} @ {g.home_team}</TableCell>
                    <TableCell>{g.market_spread}</TableCell>
                    <TableCell>{g.predicted_margin}</TableCell>
                    <TableCell>{g.actual_margin}</TableCell>
                    <TableCell>{g.edge}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex flex-col items-center justify-center">
                      <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-medium text-lg mb-1">No historical data</h3>
                      <p className="text-muted-foreground">No MLB history matches your filters.</p>
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
