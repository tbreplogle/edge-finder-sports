
import React, { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useTeamInjuries } from "@/hooks/useTeamInjuries";
import { InjuryCard } from "@/components/injury/InjuryCard";
import { TeamSelector } from "@/components/injury/TeamSelector";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { RefreshCw, Info, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const InjuryDashboard = () => {
  const [teamId, setTeamId] = useState<string>("7"); // Default to Denver Broncos
  const [viewType, setViewType] = useState<"cards" | "table">("cards");
  const { toast } = useToast();
  
  const {
    data: injuries,
    isLoading,
    isError,
    refetch,
    isFetching
  } = useTeamInjuries(teamId);

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshing injury data",
      description: "The latest injury information is being loaded.",
    });
  };

  // Group injuries by status
  const injuriesByStatus = injuries?.reduce((acc: Record<string, number>, injury) => {
    const status = injury.status || "Unknown";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  // Calculate total injuries
  const totalInjuries = injuries?.length || 0;

  return (
    <AppLayout>
      <div className="container py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">Injury Dashboard</h1>
            <p className="text-muted-foreground">
              Track the latest NFL player injuries and statuses
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="flex items-center gap-1"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span>{isFetching ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Auto-refreshes every 15min</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">Total Injuries</CardTitle>
              <CardDescription>All reported injuries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalInjuries}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-red-50 dark:bg-red-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl text-red-700 dark:text-red-400">Out</CardTitle>
              <CardDescription>Players confirmed out</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-700 dark:text-red-400">
                {injuriesByStatus?.['Out'] || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-yellow-50 dark:bg-yellow-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl text-yellow-700 dark:text-yellow-400">Questionable</CardTitle>
              <CardDescription>Players with uncertain status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">
                {injuriesByStatus?.['Questionable'] || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-green-50 dark:bg-green-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl text-green-700 dark:text-green-400">Probable</CardTitle>
              <CardDescription>Players likely to play</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-700 dark:text-green-400">
                {injuriesByStatus?.['Probable'] || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="w-full sm:w-auto">
            <TeamSelector value={teamId} onChange={setTeamId} />
          </div>
          
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground mr-2">View:</div>
            <Select value={viewType} onValueChange={(v) => setViewType(v as "cards" | "table")}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="View Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cards">Card View</SelectItem>
                <SelectItem value="table">Table View</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="h-10 w-10 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Loading injury data...</p>
            </div>
          </div>
        ) : isError ? (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <Info className="h-10 w-10 text-red-500" />
                <h3 className="text-lg font-semibold">Error Loading Data</h3>
                <p className="text-muted-foreground mb-4">
                  There was a problem loading the injury information. Please try again.
                </p>
                <Button onClick={handleRefresh}>Retry</Button>
              </div>
            </CardContent>
          </Card>
        ) : injuries?.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <Info className="h-10 w-10 text-muted-foreground" />
                <h3 className="text-lg font-semibold">No Injuries Reported</h3>
                <p className="text-muted-foreground">
                  There are currently no injuries reported for this team.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : viewType === "cards" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {injuries?.map((injury) => (
              <InjuryCard key={injury.id} injury={injury} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {injuries?.map((injury) => (
                    <TableRow key={injury.id}>
                      <TableCell className="font-medium">{injury.displayName}</TableCell>
                      <TableCell>{injury.position}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            injury.status?.toLowerCase().includes("out")
                              ? "bg-red-500"
                              : injury.status?.toLowerCase().includes("questionable")
                              ? "bg-yellow-500"
                              : injury.status?.toLowerCase().includes("doubtful")
                              ? "bg-orange-500"
                              : injury.status?.toLowerCase().includes("probable")
                              ? "bg-green-500"
                              : "bg-gray-500"
                          }
                        >
                          {injury.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(injury.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {injury.details}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 text-xs text-muted-foreground">
          <p>Data source: ESPN public API. Last updated: {new Date().toLocaleString()}</p>
          <p>Injury data auto-refreshes every 15 minutes.</p>
        </div>
      </div>
    </AppLayout>
  );
};

export default InjuryDashboard;
