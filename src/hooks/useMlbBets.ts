import { useQuery } from "@tanstack/react-query";

export function useMlbBets() {
  return useQuery({
    queryKey: ["mlb-bets"],
    queryFn: async () => {
      const res = await fetch("/api/mlb/bets");
      if (!res.ok) throw new Error("Failed to fetch MLB bets");
      return res.json();
    },
    refetchInterval: 60000,
  });
}
