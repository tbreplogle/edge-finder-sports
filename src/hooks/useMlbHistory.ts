import { useQuery } from "@tanstack/react-query";
import type { MlbResult } from "@/types/mlb";

export function useMlbHistory(season: string) {
  return useQuery<MlbResult[]>({
    queryKey: ["mlb-history", season],
    queryFn: async () => {
      const res = await fetch(`/api/mlb/results?season=${season}`);
      if (!res.ok) throw new Error("Failed to fetch MLB history");
      return res.json();
    },
  });
}
