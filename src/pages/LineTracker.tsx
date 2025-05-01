
import { AppLayout } from "@/components/AppLayout";
import { PregameLineWidget } from "@/components/PregameLineWidget";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineMovementChart } from "@/components/LineMovementChart";
import { Separator } from "@/components/ui/separator";
import { ExternalLink } from "lucide-react";

export default function LineTracker() {
  return (
    <AppLayout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Line Movement Tracker</h1>
          <p className="text-muted-foreground">
            Track real-time line movements and odds changes across major sports
          </p>
        </div>
        
        <Card className="mb-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Recent Line Movements</CardTitle>
            <CardDescription>
              Visualize how lines have moved for upcoming games
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LineMovementChart />
          </CardContent>
        </Card>
        
        <Separator className="my-8" />
        
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Pregame.com Line Movements</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            External line movement data provided by Pregame.com
          </p>
        </div>
        
        <Card className="mb-6">
          <CardContent className="p-0">
            <PregameLineWidget />
          </CardContent>
        </Card>
        
        <div className="mt-8 text-sm text-muted-foreground flex items-center">
          <p>Line movement data provided by The Odds API and Pregame.com</p>
          <a 
            href="https://the-odds-api.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="ml-2 inline-flex items-center text-xs hover:underline"
          >
            <ExternalLink size={12} className="mr-1" />
            The Odds API
          </a>
        </div>
      </div>
    </AppLayout>
  );
}
