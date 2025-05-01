
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Code, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PredictionLogicViewer } from "@/components/admin/PredictionLogicViewer";
import { PredictionDataPreview } from "@/components/admin/PredictionDataPreview";
import { PredictionFilters, FilterValues } from "@/components/admin/PredictionFilters";
import { PredictionStats } from "@/components/admin/PredictionStats";
import { PredictionsTable } from "@/components/admin/PredictionsTable";

interface Prediction extends Tables<"predictions"> {
  // Add any additional properties not in the database schema if needed
}

const AdminPreview = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<FilterValues>({
    sport: "all",
    dateSince: "today",
  });
  const [activeTab, setActiveTab] = useState<string>("predictions");
  const navigate = useNavigate();

  // Handle filter changes
  const handleFilterChange = (key: keyof FilterValues, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

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
      if (filters.dateSince === "yesterday") {
        dateFilter.setDate(dateFilter.getDate() - 1);
      } else if (filters.dateSince === "week") {
        dateFilter.setDate(dateFilter.getDate() - 7);
      } else if (filters.dateSince === "month") {
        dateFilter.setMonth(dateFilter.getMonth() - 1);
      } else if (filters.dateSince === "all") {
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
      if (filters.sport !== "all") {
        query = query.eq('sport', filters.sport.toUpperCase());
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
              {/* Filters */}
              <PredictionFilters 
                filters={filters}
                onFilterChange={handleFilterChange}
                onApplyFilters={fetchPredictions}
                isLoading={isLoading}
              />
              
              {/* Stats Cards */}
              <PredictionStats predictions={predictions} />
              
              {/* Data Table */}
              <PredictionsTable predictions={predictions} isLoading={isLoading} />
            </TabsContent>
            
            {/* Prediction Logic Tab */}
            <TabsContent value="logic">
              <PredictionLogicViewer sport={filters.sport} />
            </TabsContent>
            
            {/* Source Data Tab */}
            <TabsContent value="source">
              <PredictionDataPreview sport={filters.sport} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminPreview;
