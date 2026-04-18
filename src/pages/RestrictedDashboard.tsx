import { Moon, Sun, TrendingUp, LogOut, User, CreditCard, Lock } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const RestrictedDashboard = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header - minimal version */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50"
      >
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">
              Equity<span className="text-primary">Lens</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
              onClick={() => navigate("/profile")}
              title="View Profile"
            >
              <User className="h-3 w-3 text-primary" />
              <span className="text-secondary-foreground font-medium truncate max-w-[120px]">
                {profile?.display_name || user?.email}
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

      {/* Empty dashboard body */}
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center gap-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col items-center gap-4 text-center max-w-md"
        >
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <Lock className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            Your trial has expired
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Subscribe to a plan to unlock your watchlists, interactive multi-day price charts, the stock detail sheet, price triggers, mobile swipe gestures with Undo, the portfolio dashboard, and every feature you love.
          </p>
        </motion.div>

        {/* Navigation cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-lg"
        >
          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors group"
            onClick={() => navigate("/subscribe")}
          >
            <CardContent className="flex flex-col items-center gap-3 py-6">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Subscribe</span>
              <span className="text-xs text-muted-foreground text-center">View plans & pricing</span>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors group"
            onClick={() => navigate("/profile")}
          >
            <CardContent className="flex flex-col items-center gap-3 py-6">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <User className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Profile</span>
              <span className="text-xs text-muted-foreground text-center">Manage your account</span>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-destructive/50 transition-colors group"
            onClick={signOut}
          >
            <CardContent className="flex flex-col items-center gap-3 py-6">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center group-hover:bg-destructive/20 transition-colors">
                <LogOut className="h-5 w-5 text-destructive" />
              </div>
              <span className="text-sm font-medium text-foreground">Log Out</span>
              <span className="text-xs text-muted-foreground text-center">Sign out of your account</span>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default RestrictedDashboard;
