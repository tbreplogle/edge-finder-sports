import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Pricing from "./pages/Pricing";
import NotFound from "./pages/NotFound";
import Account from "./pages/Account";
import SportLogic from "./pages/SportLogic";
import History from "./pages/History";
import SportLogicTemplate from "./pages/SportLogicTemplate";
import AdminLogic from "./pages/AdminLogic";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Contact from "./pages/Contact";
import InjuryDashboard from "./pages/InjuryDashboard";
import AdminPreview from "./pages/AdminPreview";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Make Home page the default route */}
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/auth/:action" element={<Auth />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/account" element={<Account />} />
            <Route path="/history" element={<History />} />
            <Route path="/injuries" element={<InjuryDashboard />} />
            <Route path="/admin/sports/:sport" element={<SportLogicTemplate />} />
            <Route path="/admin/logic" element={<AdminLogic />} />
            <Route path="/admin/preview" element={<AdminPreview />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/contact" element={<Contact />} />
            {/* Redirect any unknown routes to home page */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
