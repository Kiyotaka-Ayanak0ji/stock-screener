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

import DevNoticeDialog from "./components/DevNoticeDialog";

// Lazy-loaded routes — keeps the initial bundle small for fast first paint.
// Landing is also lazy because it's a 1000+ line marketing page that should
// not block /auth, /subscribe, or other lightweight routes.
const Landing = lazy(() => import("./pages/Landing"));
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

// StockProvider is heavy (loads watchlists, polls live prices, decrypts user
// preferences). Only mount it for routes that actually render the stock table
// or related UI. Auth, Subscribe, Landing, Profile and admin routes don't need
// it and were paying its mount cost on every cold load.
const WithStocks = ({ children }: { children: React.ReactNode }) => (
  <StockProvider>{children}</StockProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <DevNoticeDialog />
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/dashboard" element={<WithStocks><Index /></WithStocks>} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/subscribe" element={<Subscribe />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/admin" element={<SubscriptionGate><AdminDashboard /></SubscriptionGate>} />
                <Route path="/portfolio" element={<SubscriptionGate><WithStocks><Portfolio /></WithStocks></SubscriptionGate>} />
                <Route path="/unsubscribe" element={<Unsubscribe />} />
                <Route path="/shared/:token" element={<SharedWatchlist />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
