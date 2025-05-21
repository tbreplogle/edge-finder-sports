import { AppLayout } from "@/components/AppLayout"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

import { pages, roles, options } from "./accessMeta"

/* ------------------------------------------------------------------------ */
/* Query helpers                                                            */
/* ------------------------------------------------------------------------ */

type Rule = {
  page_key: string
  role: "free" | "premium" | "admin"
  access_level: "none" | "preview" | "full"
}

function useAccessRules() {
  return useQuery<Rule[]>({
    queryKey: ["access-rules"],
    queryFn: async () => {
      const res  = await fetch("/api/access-rules")
      const json = await res.json()
      return json.rules as Rule[]
    },
    staleTime: 60_000
  })
}

/* ------------------------------------------------------------------------ */
/* Component                                                                */
/* ------------------------------------------------------------------------ */

export default function AccessControl() {
  const { data: rules, isLoading } = useAccessRules()
  const qc     = useQueryClient()
  const { toast } = useToast()

  const mutation = useMutation({
    mutationFn: async (body: {
      page_key: string
      role: string
      access_level: string
    }) =>
      fetch("/api/access-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }),

    onSuccess: () => {
      /* ✅ v5 syntax: single object with queryKey                    */
      qc.invalidateQueries({ queryKey: ["access-rules"] })
      toast({ description: "Rule updated" })
    },

    onError: () =>
      toast({ description: "Update failed", variant: "destructive" })
  })

  if (isLoading || !rules) {
    return (
      <AppLayout isAuthenticated>
        <div className="p-10 flex justify-center">
          <Loader2 className="animate-spin" />
        </div>
      </AppLayout>
    )
  }

  /* helper to read the active value quickly */
  const current = (p: string, r: string) =>
    rules.find(ru => ru.page_key === p && ru.role === r)?.access_level ??
    "none"

  return (
    <AppLayout isAuthenticated>
      <div className="container py-10">
        <h1 className="text-2xl font-bold mb-6">Access Control</h1>

        {pages.map(page => (
          <Card key={page} className="mb-6">
            <CardContent className="p-4">
              <h2 className="font-semibold mb-4 capitalize">
                {page.replace("_", " ")}
              </h2>

              <div className="grid grid-cols-[120px_repeat(3,1fr)] gap-4">
                <div></div>
                {roles.map(r => (
                  <div key={r} className="text-center font-medium capitalize">
                    {r}
                  </div>
                ))}

                {options.map(opt => (
                  /* row: one label + 3 radio buttons */
                  <React.Fragment key={`${page}-${opt}`}>
                    <div className="capitalize text-sm text-muted-foreground">
                      {opt}
                    </div>

                    {roles.map(role => {
                      const selected = current(page, role)
                      return (
                        <RadioGroup
                          key={`${page}-${role}-${opt}`}
                          value={selected}
                          onValueChange={() =>
                            mutation.mutate({
                              page_key: page,
                              role,
                              access_level: opt
                            })
                          }
                          className="flex justify-center"
                        >
                          <RadioGroupItem
                            value={opt}
                            checked={selected === opt}
                          />
                        </RadioGroup>
                      )
                    })}
                  </React.Fragment>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  )
}
