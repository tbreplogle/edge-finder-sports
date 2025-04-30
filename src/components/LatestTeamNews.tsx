
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface NewsItem {
  id: string;
  headline: string;
  description: string;
  date: string;
  type: string;
  imageUrl?: string;
}

interface ESPNTeamResponse {
  team: {
    displayName: string;
    nickname: string;
    logos?: Array<{
      href: string;
      width: number;
      height: number;
    }>;
  };
  injuries?: Array<{
    athlete: {
      displayName: string;
    };
    status: string;
    date: string;
    details: string;
  }>;
  news?: Array<{
    headline: string;
    description: string;
    published: string;
    images?: Array<{
      href: string;
    }>;
  }>;
  articles?: Array<{
    headline: string;
    description: string;
    published: string;
    images?: Array<{
      href: string;
    }>;
  }>;
}

export function LatestTeamNews() {
  const [news, setNews] = useState<NewsItem[]>([]);

  // Fetch team data from ESPN API
  const { data, isLoading, error } = useQuery({
    queryKey: ["espnTeamData"],
    queryFn: async () => {
      const response = await axios.get<ESPNTeamResponse>(
        "https://site.web.api.espn.com/apis/v2/sports/football/nfl/teams/7?enable=injuries"
      );
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Process the data when it's available
  useEffect(() => {
    if (data) {
      console.log("ESPN API data:", data);
      
      const newsItems: NewsItem[] = [];
      
      // Process injuries as news
      if (data.injuries && data.injuries.length > 0) {
        data.injuries.slice(0, 3).forEach((injury, idx) => {
          newsItems.push({
            id: `injury-${idx}`,
            headline: `${injury.athlete.displayName} ${injury.status}`,
            description: injury.details || "Injury update for the upcoming game.",
            date: injury.date || new Date().toISOString(),
            type: "Injuries",
            // Use team logo as default image for injuries
            imageUrl: data.team.logos?.[0]?.href
          });
        });
      }
      
      // Process articles
      if (data.articles && data.articles.length > 0) {
        data.articles.slice(0, 3).forEach((article, idx) => {
          if (!newsItems.some(item => item.headline === article.headline)) {
            newsItems.push({
              id: `article-${idx}`,
              headline: article.headline,
              description: article.description,
              date: article.published || new Date().toISOString(),
              type: "Analysis",
              imageUrl: article.images?.[0]?.href
            });
          }
        });
      }
      
      // Process news
      if (data.news && data.news.length > 0) {
        data.news.slice(0, 3).forEach((item, idx) => {
          if (!newsItems.some(newsItem => newsItem.headline === item.headline)) {
            newsItems.push({
              id: `news-${idx}`,
              headline: item.headline,
              description: item.description,
              date: item.published || new Date().toISOString(),
              type: "Updates",
              imageUrl: item.images?.[0]?.href
            });
          }
        });
      }
      
      // Take the first 3 items
      setNews(newsItems.slice(0, 3));
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold tracking-tight">Team News & Updates</h2>
        </div>
        
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold tracking-tight">Team News & Updates</h2>
        </div>
        
        <Card className="p-6">
          <p className="text-muted-foreground">
            Unable to load team data. Please try again later.
          </p>
        </Card>
      </div>
    );
  }

  // Fallback to some defaults if no news items were created
  const displayNews = news.length > 0 ? news : [
    {
      id: "default-1",
      headline: `${data?.team?.displayName || 'Team'} Latest Updates`,
      description: "Check back for the latest team news and injury updates.",
      date: new Date().toISOString(),
      type: "Updates",
      imageUrl: data?.team?.logos?.[0]?.href
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">
          {data?.team?.displayName || "Team"} News & Analysis
        </h2>
        <Button variant="ghost" className="gap-1">
          View All <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {displayNews.map((item) => (
          <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className="relative h-40 bg-muted">
              {item.imageUrl ? (
                <img 
                  src={item.imageUrl} 
                  alt={item.headline}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-edge-primary/10">
                  {data?.team?.nickname && (
                    <span className="text-xl font-bold text-edge-primary/70">
                      {data.team.nickname}
                    </span>
                  )}
                </div>
              )}
              <Badge className="absolute top-2 right-2">{item.type}</Badge>
            </div>
            <CardContent className="p-4">
              <h3 className="font-bold text-lg mb-2 line-clamp-2">{item.headline}</h3>
              <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                {item.description}
              </p>
              <div className="flex justify-between items-center">
                <time className="text-xs text-muted-foreground">
                  {new Date(item.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </time>
                <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent hover:text-edge-secondary">
                  Read More <ArrowRight className="ml-1 w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
