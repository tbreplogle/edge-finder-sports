
import React from "react";
import { AppLayout } from "@/components/AppLayout";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const InjuryResources = () => {
  const { toast } = useToast();
  
  const copyToClipboard = (text: string, description: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: description,
    });
  };

  return (
    <AppLayout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Injury Data Resources</h1>
          <p className="text-muted-foreground">
            Comprehensive guide to injury data APIs across major sports leagues
          </p>
        </div>

        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
          <p className="text-amber-800 dark:text-amber-400 text-sm">
            <span className="font-semibold">Tip:</span> Sign up for API keys, test with curl examples, then store keys in your environment variables. 
            Create proxy routes to avoid exposing keys in the browser.
          </p>
        </div>

        <Tabs defaultValue="cfbd" className="mb-8">
          <TabsList className="mb-4">
            <TabsTrigger value="cfbd">CFBD API (NCAAF)</TabsTrigger>
            <TabsTrigger value="mlb">MLB Stats API</TabsTrigger>
            <TabsTrigger value="sportsdb">TheSportsDB</TabsTrigger>
            <TabsTrigger value="setup">Implementation</TabsTrigger>
          </TabsList>

          <TabsContent value="cfbd">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>CollegeFootballData API (CFBD)</CardTitle>
                    <CardDescription>Comprehensive data for NCAAF</CardDescription>
                  </div>
                  <div>
                    <Badge variant="outline" className="ml-2">NCAAF only</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="flex gap-2 mb-2">
                    <Badge variant="secondary">Key: Free</Badge>
                    <Badge variant="secondary">50 req/min</Badge>
                    <Badge variant="secondary">2,000 req/day</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => window.open("https://collegefootballdata.com/", "_blank")}>
                      <ExternalLink className="mr-1 h-3 w-3" /> Request API Key
                    </Button>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>What you get</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Team list + IDs</TableCell>
                      <TableCell className="font-mono text-xs">/teams/fbs</TableCell>
                      <TableCell>IDs needed for other CFBD calls</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Weekly injuries</TableCell>
                      <TableCell className="font-mono text-xs">/games/injuries?season=2025&week=2</TableCell>
                      <TableCell>Returns array per game with player, position, status</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Game spread / totals</TableCell>
                      <TableCell className="font-mono text-xs">/lines?year=2025&week=2</TableCell>
                      <TableCell>Data from multiple books (pinnacle, etc.)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Play-by-play, drives, stats</TableCell>
                      <TableCell className="font-mono text-xs">many /stats/...</TableCell>
                      <TableCell>Great for power-rating model inputs</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <div className="mt-6">
                  <Card className="bg-muted/50">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Sample Request</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="relative">
                        <pre className="p-4 rounded-md bg-slate-900 text-slate-50 text-xs overflow-x-auto dark:bg-slate-950">
                          {`curl "https://api.collegefootballdata.com/games/injuries?year=2025&week=1" \\
  -H "Authorization: Bearer $CFBD_API_KEY"`}
                        </pre>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(
                            `curl "https://api.collegefootballdata.com/games/injuries?year=2025&week=1" -H "Authorization: Bearer $CFBD_API_KEY"`,
                            "CFBD API curl example"
                          )}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mlb">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>MLB Stats API</CardTitle>
                    <CardDescription>Official MLB statistics</CardDescription>
                  </div>
                  <div>
                    <Badge variant="outline" className="ml-2">No key required</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="flex gap-2 mb-2">
                    <Badge variant="secondary">No authentication</Badge>
                    <Badge variant="secondary">~60 req/min safe</Badge>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>What you get</TableHead>
                      <TableHead>Endpoint (relative to https://statsapi.mlb.com/api/v1)</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Teams list + IDs</TableCell>
                      <TableCell className="font-mono text-xs">/teams?sportId=1</TableCell>
                      <TableCell>Returns 30 MLB teams with IDs (e.g., Yankees = 10)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Schedule incl. gamePk</TableCell>
                      <TableCell className="font-mono text-xs">/schedule?teamId=147&date=2025-06-08</TableCell>
                      <TableCell>gamePk feeds other endpoints</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Probable pitchers, weather, linescore</TableCell>
                      <TableCell className="font-mono text-xs">/game/{`{gamePk}`}/feed/live</TableCell>
                      <TableCell>JSON is huge but has injuries & status</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Injured-list roster</TableCell>
                      <TableCell className="font-mono text-xs">/teams/{`{teamId}`}/roster?rosterType=injury</TableCell>
                      <TableCell>10-day/60-day IL with description</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <div className="mt-6">
                  <Card className="bg-muted/50">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Sample Request</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="relative">
                        <pre className="p-4 rounded-md bg-slate-900 text-slate-50 text-xs overflow-x-auto dark:bg-slate-950">
                          {`curl "https://statsapi.mlb.com/api/v1/teams/147/roster?rosterType=injury"`}
                        </pre>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(
                            `curl "https://statsapi.mlb.com/api/v1/teams/147/roster?rosterType=injury"`,
                            "MLB API curl example"
                          )}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sportsdb">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>TheSportsDB</CardTitle>
                    <CardDescription>Multi-sport, community-maintained data</CardDescription>
                  </div>
                  <div>
                    <Badge variant="outline" className="ml-2">Multi-sport</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="flex gap-2 mb-2">
                    <Badge variant="secondary">Free '1' key</Badge>
                    <Badge variant="secondary">1 req/sec limit</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => window.open("https://www.thesportsdb.com/", "_blank")}>
                      <ExternalLink className="mr-1 h-3 w-3" /> Request Personal Key
                    </Button>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>What you get</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Team lookup (any sport)</TableCell>
                      <TableCell className="font-mono text-xs">/searchteams.php?t=Alabama Crimson Tide</TableCell>
                      <TableCell>Returns idTeam used below</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Players with injury field</TableCell>
                      <TableCell className="font-mono text-xs">/lookup_all_players.php?id=133604</TableCell>
                      <TableCell>Field strInjury and strDescription if crowd-sourced</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Upcoming + past events</TableCell>
                      <TableCell className="font-mono text-xs">/eventsnext.php?id=134876</TableCell>
                      <TableCell>Works for NFL, MLB, college; quality varies</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Logos, headshots</TableCell>
                      <TableCell className="font-mono text-xs">/images/media/team/badge/...</TableCell>
                      <TableCell>Nice for UI</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <div className="mt-6">
                  <Card className="bg-muted/50">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Sample Request</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="relative">
                        <pre className="p-4 rounded-md bg-slate-900 text-slate-50 text-xs overflow-x-auto dark:bg-slate-950">
                          {`curl "https://www.thesportsdb.com/api/v1/json/1/searchteams.php?t=Houston%20Astros"`}
                        </pre>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(
                            `curl "https://www.thesportsdb.com/api/v1/json/1/searchteams.php?t=Houston%20Astros"`,
                            "TheSportsDB API curl example"
                          )}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="setup">
            <Card>
              <CardHeader>
                <CardTitle>Implementation Guide</CardTitle>
                <CardDescription>How to integrate these APIs into your stack</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Need</TableHead>
                      <TableHead>Drop-in source</TableHead>
                      <TableHead>Quick idea</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>NCAAF injuries</TableCell>
                      <TableCell>CFBD /games/injuries</TableCell>
                      <TableCell>Nightly job → table injuries</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>MLB injuries</TableCell>
                      <TableCell>MLB Stats /roster?rosterType=injury</TableCell>
                      <TableCell>Poll every 6h during season</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Logos for all sports</TableCell>
                      <TableCell>TheSportsDB team search → strTeamBadge</TableCell>
                      <TableCell>Cache in Supabase Storage</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Spreads / totals (NCAAF)</TableCell>
                      <TableCell>CFBD /lines</TableCell>
                      <TableCell>Use if Odds-API quota exhausted</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Schedules</TableCell>
                      <TableCell>MLB Stats schedule; CFBD /games; NFL via ESPN</TableCell>
                      <TableCell>Drives your future-prediction page</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md">
                  <h3 className="text-lg font-semibold mb-2">Implementation Strategy</h3>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Create serverless functions to proxy API calls, protecting your API keys</li>
                    <li>Set up cron jobs to periodically fetch and cache data</li>
                    <li>Store normalized injury data in a consistent format across leagues</li>
                    <li>Implement fallback data sources in case primary APIs fail</li>
                    <li>Respect rate limits with queues and intelligent retry logic</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Additional Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">ESPN API</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Currently used in the Injuries dashboard. Provides basic injury data.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => window.location.href = "/injuries"}
                  >
                    View Current Implementation
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">GitHub Resources</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Community libraries and wrappers for sports APIs.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open("https://github.com/saiemgilani/cfbfastR", "_blank")}
                  >
                    cfbfastR (R Package)
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Integration Example</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Example code for integrating with these APIs.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled
                  >
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default InjuryResources;
