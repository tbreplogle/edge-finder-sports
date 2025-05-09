import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, ArrowDownUp } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { SportTabs } from "@/components/SportTabs";
import { Button } from "@/components/ui/button";
import { GameCard } from "@/components/GameCard";
import { FeaturedGame } from "@/components/FeaturedGame";

import { fetchMlbPredictions, ProcessedMlbPrediction } from "@/utils/fetchMlbPredictions";

/* ─────────────────────────────────────────────────────────────────────────── */

export default function Dashboard() {
  const [games,  setGames]   = useState<ProcessedMlbPrediction[]>([]);
  const [loading,setLoading] = useState(true);
  const [dir,    setDir]     = useState<"asc"|"desc">("desc");
  const [admin,  setAdmin]   = useState(false);

  /* who am I */
  useEffect(()=>{
    const u = localStorage.getItem("user");
    if (u) {
      try { setAdmin(JSON.parse(u).is_admin === true); }
      catch { /* noop */ }
    }
  },[]);

  /* load MLB predictions once */
  useEffect(()=>{
    async function go() {
      setLoading(true);
      try {
        const rows = await fetchMlbPredictions();
        setGames(sort(rows,dir));
      } catch(e:any){
        console.error(e);
        toast.error("Failed to load MLB predictions");
      } finally { setLoading(false); }
    }
    go();
  },[]);               // run once

  /* re‑sort when direction flips */
  function sort(list:ProcessedMlbPrediction[], d:"asc"|"desc"){
    return [...list].sort((a,b)=>{
      const ae = Math.max(Math.abs(a.home_edge_pct||0),Math.abs(a.away_edge_pct||0));
      const be = Math.max(Math.abs(b.home_edge_pct||0),Math.abs(b.away_edge_pct||0));
      return d==="desc" ? be-ae : ae-be;
    });
  }
  const toggle = ()=> setDir(d=>d==="asc"?"desc":"asc");

  return (
    <AppLayout>
      <div className="container mx-auto py-8 space-y-6">
        <h1 className="text-3xl font-bold">Today's Predictions</h1>
        <div className="flex items-center text-muted-foreground">
          <CalendarIcon className="w-4 h-4 mr-2"/>
          <span>{format(new Date(),"EEEE, MMMM d")}</span>
        </div>

        <SportTabs activeTab="mlb" onTabChange={()=>{}}/>

        <div className="flex items-center justify-between my-4">
          <h2 className="text-xl font-semibold">MLB Games</h2>
          <Button variant="outline" size="sm" onClick={()=>{toggle(); setGames(sort(games,dir==="asc"?"desc":"asc"));}}>
            <ArrowDownUp className="w-4 h-4 mr-1"/>{dir==="desc"?"Highest":"Lowest"} Edge
          </Button>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {Array.from({length:4}).map((_,i)=>(
              <div key={i} className="h-44 bg-muted rounded-lg animate-pulse"/>
            ))}
          </div>
        ) : games.length===0 ? (
          <p className="text-muted-foreground">No MLB games available.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {games.map(g=>(
              <GameCard key={g.matchup_id} {...g} isAdmin={admin}/>
            ))}
          </div>
        )}

        <FeaturedGame />
      </div>
    </AppLayout>
  );
}
