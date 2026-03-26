import { Moon, Sun, Activity, TrendingUp, LogIn, LogOut, User, Clock, Crown, BarChart3, Briefcase } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useStocks } from "@/contexts/StockContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import AlertsPanel from "@/components/AlertsPanel";

const Header = () => {
  const { theme, toggleTheme } = useTheme();
  const { stocks, isMarketOpen } = useStocks();
  const { user, profile, signOut, isGuest } = useAuth();
  const { subscription, trialDaysLeft, isActive } = useSubscription();
  const navigate = useNavigate();

  const gainers = stocks.filter(s => s.change > 0).length;
  const losers = stocks.filter(s => s.change < 0).length;

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50"
    >
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">
              Equity<span className="text-primary">IQ</span>
            </h1>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 ml-4 px-3 py-1 rounded-full bg-secondary text-xs font-medium">
            <Activity className={`h-3 w-3 ${isMarketOpen ? "text-gain animate-pulse" : "text-loss"}`} />
            <span className="text-secondary-foreground">
              {isMarketOpen ? "Market Open" : "Market Closed"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/portfolio")}
            className="gap-1.5 text-xs hidden sm:flex"
            title="Portfolio Dashboard"
          >
            <Briefcase className="h-3.5 w-3.5" />
            Portfolio
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/compare")}
            className="gap-1.5 text-xs hidden sm:flex"
            title="Compare Stocks"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Compare
          </Button>
          <div className="hidden md:flex items-center gap-4 text-sm font-mono">
            <span className="text-gain">{gainers} ▲</span>
            <span className="text-loss">{losers} ▼</span>
            <span className="text-muted-foreground">{stocks.length - gainers - losers} —</span>
          </div>

          {user && subscription?.status === 'trial' && (
            <button
              onClick={() => navigate("/subscribe")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                trialDaysLeft <= 3
                  ? "bg-destructive/10 text-destructive hover:bg-destructive/20 animate-pulse"
                  : trialDaysLeft <= 7
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
              }`}
            >
              <Clock className="h-3 w-3" />
              {trialDaysLeft > 0 ? `${trialDaysLeft}d trial left` : "Trial expired"}
            </button>
          )}

          {user && subscription?.plan === 'lifetime' && (
            <Badge variant="secondary" className="hidden sm:flex items-center gap-1 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0">
              <Crown className="h-3 w-3" />
              Lifetime
            </Badge>
          )}

          <AlertsPanel />

          {user ? (
            <div className="flex items-center gap-2">
              <div
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
                onClick={() => navigate("/profile")}
                title="View Profile"
              >
                <User className="h-3 w-3 text-primary" />
                <span className="text-secondary-foreground font-medium truncate max-w-[120px]">
                  {profile?.display_name || user.email}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="rounded-full h-9 w-9"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/auth")}
              className="gap-1.5"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign In</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full h-9 w-9"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </motion.header>
  );
};

export default Header;
