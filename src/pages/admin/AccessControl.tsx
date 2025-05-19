
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AccessRule } from "@/types/accessRule";
import { toast } from "@/hooks/use-toast";

const fetchAccessRules = async (): Promise<AccessRule[]> => {
  const response = await fetch("/api/access-rules");
  const data = await response.json();
  return data.rules;
};

const updateAccessRule = async (rule: AccessRule): Promise<void> => {
  const response = await fetch("/api/access-rules", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(rule),
  });
  
  if (!response.ok) {
    throw new Error("Failed to update access rule");
  }
};

export default function AccessControl() {
  const queryClient = useQueryClient();
  const [editingRule, setEditingRule] = useState<AccessRule | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["access-rules"],
    queryFn: fetchAccessRules,
  });

  const mutation = useMutation({
    mutationFn: updateAccessRule,
    onSuccess: () => {
      // Use the correct invalidation syntax
      queryClient.invalidateQueries({ queryKey: ["access-rules"] });
      toast({
        title: "Access rule updated",
        description: "The access rule has been successfully updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update access rule: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Group rules by page
  const pageGroups = rules.reduce((acc, rule) => {
    if (!acc[rule.page_key]) {
      acc[rule.page_key] = [];
    }
    acc[rule.page_key].push(rule);
    return acc;
  }, {} as Record<string, AccessRule[]>);

  const handleAccessLevelChange = (
    rule: AccessRule,
    newLevel: "none" | "preview" | "full"
  ) => {
    const updatedRule = { ...rule, access_level: newLevel };
    mutation.mutate(updatedRule);
  };

  return (
    <AppLayout isAuthenticated={true}>
      <div className="container py-6">
        <h1 className="text-3xl font-bold mb-6">Access Control</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Page Access Rules</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-4 text-center">Loading access rules...</div>
            ) : (
              <div className="space-y-8">
                {Object.entries(pageGroups).map(([pageKey, pageRules]) => (
                  <div key={pageKey} className="space-y-4">
                    <h3 className="text-xl font-bold capitalize">
                      {pageKey.replace('_', ' ')}
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Role</TableHead>
                          <TableHead>Access Level</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageRules.map((rule) => (
                          <TableRow key={`${rule.page_key}-${rule.role}`}>
                            <TableCell className="font-medium capitalize">
                              {rule.role}
                            </TableCell>
                            <TableCell>
                              <AccessLevelBadge level={rule.access_level} />
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <AccessLevelButton
                                  level="none"
                                  currentLevel={rule.access_level}
                                  onClick={() =>
                                    handleAccessLevelChange(rule, "none")
                                  }
                                />
                                <AccessLevelButton
                                  level="preview"
                                  currentLevel={rule.access_level}
                                  onClick={() =>
                                    handleAccessLevelChange(rule, "preview")
                                  }
                                />
                                <AccessLevelButton
                                  level="full"
                                  currentLevel={rule.access_level}
                                  onClick={() =>
                                    handleAccessLevelChange(rule, "full")
                                  }
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function AccessLevelBadge({ level }: { level: string }) {
  switch (level) {
    case "full":
      return <Badge className="bg-green-500">Full Access</Badge>;
    case "preview":
      return <Badge className="bg-yellow-500">Preview</Badge>;
    case "none":
    default:
      return <Badge variant="destructive">No Access</Badge>;
  }
}

function AccessLevelButton({
  level,
  currentLevel,
  onClick,
}: {
  level: "none" | "preview" | "full";
  currentLevel: string;
  onClick: () => void;
}) {
  const isActive = level === currentLevel;
  
  let variant: "outline" | "default" | "destructive" = "outline";
  let label = "";
  
  switch (level) {
    case "full":
      variant = isActive ? "default" : "outline";
      label = "Full";
      break;
    case "preview":
      variant = isActive ? "default" : "outline";
      label = "Preview";
      break;
    case "none":
      variant = isActive ? "destructive" : "outline";
      label = "None";
      break;
  }

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={onClick}
      disabled={isActive}
    >
      {label}
    </Button>
  );
}
