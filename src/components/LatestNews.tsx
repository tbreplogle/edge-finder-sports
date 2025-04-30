
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Newspaper, Loader2 } from "lucide-react";
import { useNews, LeagueType } from "@/hooks/useNews";

const LEAGUES = ["mlb", "nfl", "ncaaf", "ncaab"] as const;

export function LatestNews() {
  const [league, setLeague] = useState<LeagueType>("mlb");
  const { data: articles, isLoading, error } = useNews(league);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Latest News & Analysis</h2>
        <div className="flex space-x-2">
          {LEAGUES.map((l) => (
            <Button
              key={l}
              size="sm"
              variant={league === l ? "default" : "outline"}
              onClick={() => setLeague(l)}
              className={league === l ? "bg-edge-" + l : ""}
            >
              {l.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>
      
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}
      
      {error && (
        <Card className="p-6">
          <p className="text-muted-foreground text-center">
            Unable to load news. Please try again later.
          </p>
        </Card>
      )}
      
      {!isLoading && !error && articles?.length === 0 && (
        <Card className="p-6">
          <p className="text-muted-foreground text-center">
            No news found for {league.toUpperCase()}.
          </p>
        </Card>
      )}
      
      {!isLoading && !error && articles && articles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {articles.slice(0, 3).map((item, index) => (
            <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative h-40 bg-muted">
                {item.thumbnail ? (
                  <img 
                    src={item.thumbnail} 
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-edge-primary/10">
                    <Newspaper className="h-10 w-10 text-edge-primary/50" />
                  </div>
                )}
                <Badge className="absolute top-2 right-2">{league.toUpperCase()}</Badge>
              </div>
              <CardContent className="p-4">
                <h3 className="font-bold text-lg mb-2 line-clamp-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                  {item.description || "Read more for details..."}
                </p>
                <div className="flex justify-between items-center">
                  <time className="text-xs text-muted-foreground">
                    {new Date(item.published).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </time>
                  <a 
                    href={item.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent hover:text-edge-secondary">
                      Read More <ArrowRight className="ml-1 w-3 h-3" />
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
