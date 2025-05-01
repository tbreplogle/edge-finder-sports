
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface InjuryPlayer {
  id: string;
  displayName: string;
  position: string;
  status: string;
  date: string;
  details: string;
  team: string;
  teamLogo?: string;
}

export function useTeamInjuries(teamId: string = "7") {
  return useQuery({
    queryKey: ["team-injuries", teamId],
    queryFn: async (): Promise<InjuryPlayer[]> => {
      try {
        const { data } = await axios.get(
          `https://site.web.api.espn.com/apis/v2/sports/football/nfl/teams/${teamId}?enable=injuries`
        );
        
        console.log("ESPN injury data:", data);
        
        if (!data.injuries || !Array.isArray(data.injuries)) {
          return [];
        }
        
        return data.injuries.map((injury: any) => ({
          id: injury.athlete?.id || Math.random().toString(),
          displayName: injury.athlete?.displayName || "Unknown Player",
          position: injury.athlete?.position?.abbreviation || "N/A",
          status: injury.status || "Unknown",
          date: injury.date || new Date().toISOString(),
          details: injury.details || "No details available",
          team: data.team?.displayName || "Unknown Team",
          teamLogo: data.team?.logos?.[0]?.href
        }));
      } catch (err) {
        console.error("Error fetching team injuries:", err);
        throw new Error("Failed to fetch injury data");
      }
    },
    staleTime: 1000 * 60 * 15, // 15 minutes cache
  });
}
