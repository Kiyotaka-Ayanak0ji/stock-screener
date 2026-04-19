import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { StockProvider } from "@/contexts/StockContext";
import SubscriptionGate from "@/components/SubscriptionGate";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

import Landing from "./pages/Landing";
import DevNoticeDialog from "./components/DevNoticeDialog";

// Lazy-loaded routes — keeps the initial Landing bundle small for fast first paint.
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Subscribe = lazy(() => import("./pages/Subscribe"));
const SharedWatchlist = lazy(() => import("./pages/SharedWatchlist"));
const Profile = lazy(() => import("./pages/Profile"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <StockProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <DevNoticeDialog />
            <BrowserRouter>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/dashboard" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/subscribe" element={<Subscribe />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/admin" element={<SubscriptionGate><AdminDashboard /></SubscriptionGate>} />
                  <Route path="/portfolio" element={<SubscriptionGate><Portfolio /></SubscriptionGate>} />
                  <Route path="/unsubscribe" element={<Unsubscribe />} />
                  <Route path="/shared/:token" element={<SharedWatchlist />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </StockProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
