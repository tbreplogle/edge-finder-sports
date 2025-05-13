import { useAuth } from "@/context/AuthProvider";
import { useQuery } from "@tanstack/react-query";

/** one fetch for all rules */
function useAccessRules() {
  return useQuery({
    queryKey: ["access-rules"],
    queryFn: async () => {
      const res = await fetch("/api/access-rules");
      const json = await res.json();
      return json.rules as {
        page_key: string;
        role: "free" | "premium" | "admin";
        access_level: "none" | "preview" | "full";
      }[];
    },
    staleTime: 60_000,
  });
}

/** returns 'none' | 'preview' | 'full' for current user + page */
export function usePageAccess(pageKey: string) {
  const { data: rules } = useAccessRules();
  const { user } = useAuth(); // user?.role === 'free' | 'premium' | 'admin'
  if (!rules || !user) return "none";
  const match = rules.find(
    (r) => r.page_key === pageKey && r.role === user.role,
  );
  return match?.access_level ?? "none";
}
