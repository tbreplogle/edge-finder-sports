
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { RefreshCw, Filter, Database, Code, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PredictionLogicViewer } from "@/components/admin/PredictionLogicViewer";
import { PredictionDataPreview } from "@/components/admin/PredictionDataPreview";

interface Prediction extends Tables<"predictions"> {
  // Add any additional properties not in the database schema if needed
}

const AdminPreview = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState<string>("all");
  const [dateSince, setDateSince] = useState<string>("today");
  const [activeTab, setActiveTab] = useState<string>("predictions");
  const navigate = useNavigate();

  // Check if user is admin
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        
        // First check locally stored user data
        const userStr = localStorage.getItem("user");
        let localAdminStatus = false;
        
        if (userStr) {
          try {
            const userData = JSON.parse(userStr);
            localAdminStatus = !!userData.is_admin;
            
            // Set admin status from localStorage immediately to prevent flicker
            if (localAdminStatus) {
              setIsAdmin(true);
            }
          } catch (e) {
            console.error("Error parsing user data:", e);
          }
        }
        
        // Get session from Supabase
        const { data } = await supabase.auth.getSession();
        
        if (data.session) {
          const user = data.session.user;
          const isAdminUser = user.user_metadata?.is_admin === true;
          
          if (isAdminUser || localAdminStatus) {
            setIsAdmin(true);
            fetchPredictions();
          } else {
            // Not an admin, show toast and redirect
            toast.error("Access Denied", {
              description: "You need admin privileges to access this page."
            });
            navigate("/");
          }
        } else if (!localAdminStatus) {
          // No session and no local admin status, redirect to login
          toast.error("Authentication Required", {
            description: "Please log in to continue."
          });
          navigate("/auth/login", { state: { returnUrl: "/admin/preview" } });
        }
      } catch (error) {
        console.error("Error verifying admin status:", error);
        if (!isAdmin) {
          toast.error("Authentication Error", {
            description: "Please try logging in again."
          });
          navigate("/auth/login", { state: { returnUrl: "/admin/preview" } });
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [navigate]);

  // Function to fetch predictions from the database
  const fetchPredictions = async () => {
    setIsLoading(true);
    
    try {
      // Determine the date filter
      let dateFilter = new Date();
      if (dateSince === "yesterday") {
        dateFilter.setDate(dateFilter.getDate() - 1);
      } else if (dateSince === "week") {
        dateFilter.setDate(dateFilter.getDate() - 7);
      } else if (dateSince === "month") {
        dateFilter.setMonth(dateFilter.getMonth() - 1);
      } else if (dateSince === "all") {
        dateFilter = new Date(2000, 0, 1); // Far in the past
      }
      
      const dateString = dateFilter.toISOString().split('T')[0];
      
      // Create the query with proper typing
      let query = supabase
        .from("predictions")
        .select('*')
        .gte('game_date', dateString)
        .order('updated_at', { ascending: false });
      
      // Add sport filter if not "all"
      if (selectedSport !== "all") {
        query = query.eq('sport', selectedSport.toUpperCase());
      }
      
      // Execute the query
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      setPredictions(data || []);
      toast.success("Data loaded", {
        description: `Loaded ${data?.length || 0} predictions`
      });
    } catch (err: any) {
      console.error("Error fetching predictions:", err);
      toast.error("Failed to load data", {
        description: err.message || "An unexpected error occurred"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to format moneyline odds with + sign
  const formatMoneyline = (ml?: number | null) => {
    if (ml === undefined || ml === null) return "—";
    return ml > 0 ? `+${ml}` : `${ml}`;
  };
  
  if (!isAdmin && !isLoading) {
    return (
      <AppLayout>
        <div className="container py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="mb-6">You need admin privileges to access this page.</p>
          <Button 
            onClick={() => navigate("/")}
            className="bg-edge-secondary hover:bg-edge-secondary/90"
          >
            Return to Home
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container py-6">
        <div className="flex flex-col gap-6">
          {/* Header with navigation */}
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Admin Prediction Preview</h1>
            <div className="space-x-2">
              <Button 
                variant="outline" 
                onClick={() => navigate("/admin/logic")}
                className="flex items-center gap-2"
              >
                <Code className="h-4 w-4" />
                Logic Lab
              </Button>
              <Button 
                onClick={() => navigate("/dashboard")}
                variant="secondary"
              >
                Dashboard
              </Button>
            </div>
          </div>
          
          {/* Main Content Tabs */}
          <Tabs
            defaultValue="predictions"
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="predictions">Prediction Data</TabsTrigger>
              <TabsTrigger value="logic">Prediction Logic</TabsTrigger>
              <TabsTrigger value="source">Source Data</TabsTrigger>
            </TabsList>
            
            {/* Prediction Data Tab */}
            <TabsContent value="predictions" className="space-y-6">
              {/* Filters and controls */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Filters</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm text-muted-foreground">Sport</label>
                      <Select
                        value={selectedSport}
                        onValueChange={setSelectedSport}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Select sport" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sports</SelectItem>
                          <SelectItem value="nfl">NFL</SelectItem>
                          <SelectItem value="ncaaf">NCAAF</SelectItem>
                          <SelectItem value="ncaab">NCAAB</SelectItem>
                          <SelectItem value="mlb">MLB</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <label className="text-sm text-muted-foreground">Date Range</label>
                      <Select
                        value={dateSince}
                        onValueChange={setDateSince}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Date range" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="yesterday">Since Yesterday</SelectItem>
                          <SelectItem value="week">Last Week</SelectItem>
                          <SelectItem value="month">Last Month</SelectItem>
                          <SelectItem value="all">All Time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Button 
                      className="mt-auto"
                      onClick={fetchPredictions}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Filter className="h-4 w-4 mr-2" />
                      )}
                      Apply Filters
                    </Button>
                    
                    <Button 
                      variant="outline"
                      className="mt-auto"
                      onClick={fetchPredictions}
                      disabled={isLoading}
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                      <span className="ml-2">Refresh</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Predictions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{predictions.length}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">MLB Predictions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {predictions.filter(p => p.sport === "MLB").length}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Avg. Edge</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {predictions.length > 0 
                        ? (predictions.reduce((acc, p) => acc + (p.edge || 0), 0) / predictions.length).toFixed(2)
                        : "0.00"}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Latest Update</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-bold">
                      {predictions.length > 0
                        ? new Date(predictions[0]?.updated_at).toLocaleString()
                        : "No data"}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Data Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">ID</TableHead>
                      <TableHead className="w-20">Sport</TableHead>
                      <TableHead>Game</TableHead>
                      <TableHead className="w-32 text-right">Predicted Margin</TableHead>
                      <TableHead className="w-24 text-right">Home ML</TableHead>
                      <TableHead className="w-24 text-right">Away ML</TableHead>
                      <TableHead className="w-24 text-right">Edge</TableHead>
                      <TableHead className="w-32">Game Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center h-24">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : predictions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                          No predictions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      predictions.map((prediction) => (
                        <TableRow key={prediction.id}>
                          <TableCell className="font-mono text-xs">{prediction.id}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{prediction.sport}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{prediction.away_team} @ {prediction.home_team}</div>
                            <div className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{prediction.game_id}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            {prediction.predicted_margin ? (
                              prediction.predicted_margin > 0 ? (
                                <span className="text-green-600">+{Number(prediction.predicted_margin).toFixed(1)}</span>
                              ) : (
                                <span className="text-red-600">{Number(prediction.predicted_margin).toFixed(1)}</span>
                              )
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatMoneyline(prediction.home_ml)}
                            {prediction.market_home_ml ? (
                              <div className="text-xs text-muted-foreground">
                                ({formatMoneyline(prediction.market_home_ml)})
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatMoneyline(prediction.away_ml)}
                            {prediction.market_away_ml ? (
                              <div className="text-xs text-muted-foreground">
                                ({formatMoneyline(prediction.market_away_ml)})
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            {prediction.edge !== null ? (
                              <span className={Number(prediction.edge) > 0 ? "text-green-600" : "text-red-600"}>
                                {Number(prediction.edge).toFixed(1)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(prediction.game_date).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            
            {/* Prediction Logic Tab */}
            <TabsContent value="logic">
              <PredictionLogicViewer sport={selectedSport} />
            </TabsContent>
            
            {/* Source Data Tab */}
            <TabsContent value="source">
              <PredictionDataPreview sport={selectedSport} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminPreview;
