
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InjuryPlayer } from "@/hooks/useTeamInjuries";

interface InjuryCardProps {
  injury: InjuryPlayer;
}

export function InjuryCard({ injury }: InjuryCardProps) {
  // Function to determine status color
  const getStatusColor = (status: string): string => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("out")) return "bg-red-500 hover:bg-red-600";
    if (statusLower.includes("questionable")) return "bg-yellow-500 hover:bg-yellow-600";
    if (statusLower.includes("doubtful")) return "bg-orange-500 hover:bg-orange-600";
    if (statusLower.includes("probable")) return "bg-green-500 hover:bg-green-600";
    return "bg-gray-500 hover:bg-gray-600";
  };

  // Format the date
  const formattedDate = new Date(injury.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {injury.teamLogo && (
              <img 
                src={injury.teamLogo} 
                alt={injury.team} 
                className="w-6 h-6 object-contain"
              />
            )}
            <span className="font-semibold text-sm text-muted-foreground">{injury.team}</span>
          </div>
          <Badge variant="outline" className="text-xs">{injury.position}</Badge>
        </div>
        
        <h3 className="font-bold text-lg mb-1">{injury.displayName}</h3>
        
        <div className="flex items-center justify-between mb-2">
          <Badge className={getStatusColor(injury.status)}>{injury.status}</Badge>
          <span className="text-xs text-muted-foreground">{formattedDate}</span>
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-2">{injury.details}</p>
      </CardContent>
    </Card>
  );
}
