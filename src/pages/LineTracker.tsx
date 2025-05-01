
import { AppLayout } from "@/components/AppLayout";
import { PregameLineWidget } from "@/components/PregameLineWidget";

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
        
        <div className="border rounded-lg bg-card p-4">
          <PregameLineWidget />
        </div>
        
        <div className="mt-6 text-sm text-muted-foreground">
          <p>Line movement data provided by Pregame.com</p>
        </div>
      </div>
    </AppLayout>
  );
}
