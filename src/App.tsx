import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { StockProvider } from "@/contexts/StockContext";
import Index from "./pages/Index";
import DevNoticeDialog from "./components/DevNoticeDialog";
import Auth from "./pages/Auth";
import Subscribe from "./pages/Subscribe";
import SharedWatchlist from "./pages/SharedWatchlist";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/subscribe" element={<Subscribe />} />
                <Route path="/shared/:token" element={<SharedWatchlist />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </StockProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
