// src/pages/AccessControl.tsx
import { FC } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { pages, roles, options } from "@/pages/accessMeta";

interface Rule {
  page_key: string;
  role: "free" | "premium" | "admin";
  access_level: "none" | "preview" | "full";
}

function useAccessRules() {
  return useQuery<Rule[]>({
    queryKey: ["access-rules"],
    queryFn: async () => {
      const res = await fetch("/api/access-rules");
      if (!res.ok) throw new Error("Failed to load access rules");
      const { rules } = await res.json();
      return rules;
    },
    staleTime: 60_000,
  });
}

const AccessControl: FC = () => {
  const { data: rules, isLoading } = useAccessRules();
  const qc = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (body: {
      page_key: string;
      role: string;
      access_level: string;
    }) => {
      const res = await fetch("/api/access-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Update failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access-rules"] });
      toast({ description: "Rule updated" });
    },
    onError: () =>
      toast({ description: "Update failed", variant: "destructive" }),
  });

  if (isLoading || !rules) {
    return (
      <AppLayout isAuthenticated>
        <div className="p-10 flex justify-center">
          <Loader2 className="animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const current = (pageKey: string, role: string) =>
    rules.find((r) => r.page_key === pageKey && r.role === role)
      ?.access_level ?? "none";

  return (
    <AppLayout isAuthenticated>
      <div className="container py-10">
        <h1 className="text-2xl font-bold mb-6">Access Control</h1>

        {pages.map((pageKey) => (
          <Card key={pageKey} className="mb-6">
            <CardContent className="p-4">
              <h2 className="font-semibold mb-4 capitalize">
                {pageKey.replace("_", " ")}
              </h2>

              <div className="grid grid-cols-[120px_repeat(3,1fr)] gap-4">
                <div></div>
                {roles.map((r) => (
                  <div
                    key={`${pageKey}-${r}-hdr`}
                    className="text-center font-medium capitalize"
                  >
                    {r}
                  </div>
                ))}

                {options.map((opt) => (
                  <React.Fragment key={`${pageKey}-${opt}`}>
                    <div className="capitalize text-sm text-muted-foreground">
                      {opt}
                    </div>
                    {roles.map((r) => (
                      <div key={`${pageKey}-${r}-${opt}`}>
                        <RadioGroup
                          value={current(pageKey, r)}
                          onValueChange={(val) =>
                            mutation.mutate({
                              page_key: pageKey,
                              role: r,
                              access_level: val,
                            })
                          }
                          className="flex justify-center"
                        >
                          <RadioGroupItem value={opt} />
                        </RadioGroup>
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
};

export default AccessControl;
