
import { AppLayout } from "@/components/AppLayout";
import { PregameLineWidget } from "@/components/PregameLineWidget";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LineTracker() {
  return (
    <AppLayout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Line Movement Tracker</h1>
          <p className="text-muted-foreground">
            Track real-time line movements and odds changes across all major sports
          </p>
        </div>
        
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Live Line Movements</CardTitle>
            <CardDescription>
              View and track the latest betting line movements across major sportsbooks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PregameLineWidget />
          </CardContent>
        </Card>
        
        <div className="mt-6 text-sm text-muted-foreground">
          <p>Line movement data provided by Pregame.com</p>
        </div>
      </div>
    </AppLayout>
  );
}
