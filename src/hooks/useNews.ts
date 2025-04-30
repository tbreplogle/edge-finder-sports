
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

// Define the article type
export interface NewsArticle {
  title: string;
  description?: string;
  author?: string;
  url?: string;
  published: string;
  thumbnail?: string;
}

// ESPN API endpoints for different leagues
const ENDPOINTS: Record<string, string> = {
  nfl: "https://site.api.espn.com/apis/v2/sports/football/nfl/news",
  ncaaf: "https://site.api.espn.com/apis/v2/sports/football/college-football/news",
  ncaab: "https://site.api.espn.com/apis/v2/sports/basketball/men-college-basketball/news",
  mlb: "https://site.api.espn.com/apis/v2/sports/baseball/mlb/news"
};

export type LeagueType = "mlb" | "nfl" | "ncaaf" | "ncaab";

export function useNews(league: LeagueType) {
  return useQuery({
    queryKey: ["news", league],
    queryFn: async (): Promise<NewsArticle[]> => {
      const url = ENDPOINTS[league];
      if (!url) throw new Error("Unsupported league");

      try {
        const { data } = await axios.get(url, { 
          params: { limit: 10, region: "us" } 
        });

        return (data.articles || []).map((a: any) => ({
          title: a.headline,
          description: a.description,
          author: a?.byline ?? "",
          url: a.links?.web?.href,
          published: a.published,
          thumbnail: a.images?.[0]?.url ?? null
        }));
      } catch (err) {
        console.error("[news] fetch failed", err);
        throw new Error("Failed to fetch news");
      }
    },
    staleTime: 1000 * 60 * 15, // 15 minutes cache
  });
}
