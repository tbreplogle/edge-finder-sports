
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Star } from "lucide-react";

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  date: string;
  category: string;
  imageUrl?: string;
}

// Sample news data - in a real application, this would come from an API
const sampleNews: NewsItem[] = [
  {
    id: "1",
    title: "New Algorithm Improvement Increases Edge Accuracy by 15%",
    summary: "Our data science team has deployed a significant update to our NFL prediction model, resulting in improved accuracy across all game types.",
    date: "2025-04-25",
    category: "Updates",
    imageUrl: "https://images.unsplash.com/photo-1518877593221-1f28583780b4?ixlib=rb-1.2.1&auto=format&fit=crop&w=600&q=80"
  },
  {
    id: "2",
    title: "Why Home Field Advantage Matters Less in the Playoffs",
    summary: "Our analysis of the last five seasons shows that home field advantage decreases significantly during playoff games. Here's the breakdown.",
    date: "2025-04-20",
    category: "Analysis",
    imageUrl: "https://images.unsplash.com/photo-1487252665478-49b61b47f302?ixlib=rb-1.2.1&auto=format&fit=crop&w=600&q=80"
  },
  {
    id: "3",
    title: "College Basketball: Identifying Value in Conference Tournaments",
    summary: "Conference tournaments provide unique betting opportunities. Our new NCAAB guide explains how to identify value in these high-stakes games.",
    date: "2025-04-15",
    category: "NCAAB",
    imageUrl: "https://images.unsplash.com/photo-1452378174528-3090a4bba7b2?ixlib=rb-1.2.1&auto=format&fit=crop&w=600&q=80"
  }
];

export function LatestNews() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Latest News & Analysis</h2>
        <Button variant="ghost" className="gap-1">
          View All <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sampleNews.map((item) => (
          <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className="relative h-40 bg-muted">
              {item.imageUrl ? (
                <img 
                  src={item.imageUrl} 
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-edge-primary/10">
                  <Star className="h-10 w-10 text-edge-primary/50" />
                </div>
              )}
              <Badge className="absolute top-2 right-2">{item.category}</Badge>
            </div>
            <CardContent className="p-4">
              <h3 className="font-bold text-lg mb-2 line-clamp-2">{item.title}</h3>
              <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                {item.summary}
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
