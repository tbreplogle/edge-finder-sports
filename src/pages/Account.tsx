
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ExternalLink, CreditCard, Calendar, LogOut, Loader2, Code } from "lucide-react";
import { toast } from "@/components/ui/sonner";

interface UserData {
  email: string;
  name: string;
  role: string;
  is_admin: boolean;
}

interface SubscriptionData {
  status: string;
  plan_key: string;
  current_period_end: string | null;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
}

const Account = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserData | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      navigate("/auth/login");
      return;
    }
    
    try {
      const userData = JSON.parse(userStr);
      setUser(userData);
      
      // In a real app, we would fetch subscription data from the backend
      // For now, we'll use mock data
      if (userData.is_admin) {
        setSubscription({
          status: "active",
          plan_key: "ADMIN",
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          stripe_customer_id: "cus_mock_admin",
          stripe_subscription_id: "sub_mock_admin"
        });
      } else if (userData.role === "premium") {
        setSubscription({
          status: "active",
          plan_key: "MONTHLY",
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          stripe_customer_id: "cus_mock_premium",
          stripe_subscription_id: "sub_mock_premium"
        });
      } else {
        setSubscription({
          status: "inactive",
          plan_key: "FREE",
          current_period_end: null
        });
      }
    } catch (e) {
      console.error("Error parsing user data:", e);
      navigate("/auth/login");
    }
  }, [navigate]);
  
  const handleOpenCustomerPortal = async () => {
    setIsPortalLoading(true);
    
    // In a real app, this would call the Stripe Customer Portal API endpoint
    // For demo purposes, we'll simulate a delay and show a toast
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.info("In a production app, this would redirect to the Stripe Customer Portal");
      console.log("Would call /api/create-portal-session with:", {
        returnUrl: window.location.href
      });
      console.log("Customer ID that would be used:", subscription?.stripe_customer_id);
      
      // In production, this would redirect:
      // window.location.href = portalUrl;
    } catch (error) {
      toast.error("Error opening customer portal");
      console.error(error);
    } finally {
      setIsPortalLoading(false);
    }
  };
  
  const handleLogout = () => {
    localStorage.removeItem("user");
    toast.success("You have been logged out");
    navigate("/");
  };

  // Format subscription end date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/Chicago"
    });
  };
  
  // Map plan key to display name
  const getPlanName = (planKey: string) => {
    const plans: Record<string, string> = {
      "FREE": "Free Plan",
      "MONTHLY": "Monthly Premium",
      "ANNUAL": "Annual Premium",
      "ADMIN": "Admin Access (All Features)"
    };
    return plans[planKey] || planKey;
  };
  
  return (
    <div className="flex flex-col min-h-screen">
      <AppLayout showHeader={true} isAuthenticated={true}>
        <h1 className="text-2xl md:text-3xl font-bold mb-8">Account Management</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Details</CardTitle>
                <CardDescription>Manage your PlayEdge subscription</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {user?.is_admin ? (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                    <h3 className="font-medium text-yellow-500 flex items-center gap-2 mb-2">
                      <span>Admin Account</span>
                    </h3>
                    <p className="text-sm">
                      You have full access to all features as an administrator.
                    </p>
                    <Button 
                      onClick={() => navigate("/admin/logic")}
                      className="mt-4 bg-edge-secondary hover:bg-edge-secondary/90"
                    >
                      <Code className="mr-2 h-4 w-4" />
                      Access Logic Lab
                    </Button>
                  </div>
                ) : subscription ? (
                  <>
                    <div className="flex flex-col md:flex-row justify-between">
                      <div>
                        <h3 className="font-medium text-lg">{getPlanName(subscription.plan_key)}</h3>
                        <p className="text-muted-foreground mt-1 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${subscription.status === 'active' ? 'bg-green-500' : 'bg-orange-500'}`}></span>
                          <span className="capitalize">{subscription.status}</span>
                        </p>
                      </div>
                      
                      <div className="mt-4 md:mt-0 flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4" />
                        <span>Renews: {formatDate(subscription.current_period_end)}</span>
                      </div>
                    </div>
                    
                    <Button 
                      onClick={handleOpenCustomerPortal}
                      className="w-full md:w-auto"
                      disabled={isPortalLoading || subscription.plan_key === "FREE"}
                    >
                      {isPortalLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          <span>Loading...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          <span>Manage Subscription</span>
                        </>
                      )}
                    </Button>
                    
                    <div className="text-sm text-muted-foreground pt-4 border-t">
                      <p>
                        Manage your subscription through the Stripe Customer Portal where you can:
                      </p>
                      <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>Update your payment method</li>
                        <li>Change your subscription plan</li>
                        <li>Cancel your subscription</li>
                      </ul>
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-card border rounded-md">
                    <p className="text-center text-muted-foreground">
                      You don't have an active subscription.
                    </p>
                    <Button 
                      className="w-full mt-4"
                      onClick={() => navigate("/pricing")}
                    >
                      View Pricing Plans
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Billing History</CardTitle>
                <CardDescription>Your recent invoices</CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted">
                        <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                        <th className="px-4 py-3 text-right text-sm font-medium">Amount</th>
                        <th className="px-4 py-3 text-right text-sm font-medium">Status</th>
                        <th className="px-4 py-3 text-right text-sm font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Mock data - in a real app, these would come from the Stripe API */}
                      <tr className="border-t">
                        <td className="px-4 py-3 text-sm">Apr 1, 2025</td>
                        <td className="px-4 py-3 text-sm">Premium Subscription</td>
                        <td className="px-4 py-3 text-sm text-right">$19.99</td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-medium">
                            Paid
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                            <span className="sr-only">View invoice</span>
                          </Button>
                        </td>
                      </tr>
                      <tr className="border-t">
                        <td className="px-4 py-3 text-sm">Mar 1, 2025</td>
                        <td className="px-4 py-3 text-sm">Premium Subscription</td>
                        <td className="px-4 py-3 text-sm text-right">$19.99</td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-medium">
                            Paid
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                            <span className="sr-only">View invoice</span>
                          </Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {user && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Name</label>
                      <p>{user.name}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Email</label>
                      <p>{user.email}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Account Type</label>
                      <p className="capitalize">{user.is_admin ? "Administrator" : user.role}</p>
                    </div>
                    
                    <Button 
                      variant="destructive" 
                      className="w-full mt-4"
                      onClick={handleLogout}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    </div>
  );
};

export default Account;
