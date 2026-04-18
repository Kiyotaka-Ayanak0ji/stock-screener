import { useState } from "react";
import { Moon, Sun, Activity, TrendingUp, LogIn, LogOut, User, Clock, Crown, Briefcase, Shield, Menu, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useStocks } from "@/contexts/StockContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import AlertsPanel from "@/components/AlertsPanel";

const Header = () => {
  const { theme, toggleTheme } = useTheme();
  const { isMarketOpen } = useStocks();
  const { user, profile, signOut, isGuest } = useAuth();
  const { subscription, trialDaysLeft, isActive } = useSubscription();
  const { isAdmin } = useAdminRole();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const hasActiveAccess = isActive;

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50"
    >
      <div className="container mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">
              Equity<span className="text-primary">Lens</span>
            </h1>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 ml-4 px-3 py-1 rounded-full bg-secondary text-xs font-medium">
            <Activity className={`h-3 w-3 ${isMarketOpen ? "text-gain animate-pulse" : "text-loss"}`} />
            <span className="text-secondary-foreground">
              {isMarketOpen ? "Market Open" : "Market Closed"}
            </span>
          </div>
        </div>

        {/* Desktop Nav */}
        <div className="hidden sm:flex items-center gap-2">
          {hasActiveAccess && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/portfolio")}
              className="gap-1.5 text-xs"
              title="Portfolio Dashboard"
            >
              <Briefcase className="h-3.5 w-3.5" />
              Portfolio
            </Button>
          )}

          {user && subscription?.status === 'trial' && (
            <button
              onClick={() => navigate("/subscribe")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                trialDaysLeft <= 3
                  ? "bg-destructive/10 text-destructive hover:bg-destructive/20 animate-pulse"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
              }`}
            >
              <Clock className="h-3 w-3" />
              {trialDaysLeft > 0 ? `${trialDaysLeft}d trial left` : "Trial expired"}
            </button>
          )}

          {user && subscription?.plan === 'lifetime' && (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0">
              <Crown className="h-3 w-3" />
              Lifetime
            </Badge>
          )}

          {hasActiveAccess && <AlertsPanel />}

          {user ? (
            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
                onClick={() => navigate("/profile")}
                title="View Profile"
              >
                <User className="h-3 w-3 text-primary" />
                <span className="text-secondary-foreground font-medium truncate max-w-[120px]">
                  {profile?.display_name || user.email}
                </span>
                {isAdmin && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] font-semibold bg-primary/15 text-primary border-0">
                    <Shield className="h-2.5 w-2.5 mr-0.5" />
                    Admin
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={signOut} className="rounded-full h-9 w-9" title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => navigate("/auth")} className="gap-1.5">
              <LogIn className="h-3.5 w-3.5" />
              Sign In
            </Button>
          )}

          <Button variant="outline" size="icon" onClick={toggleTheme} className="rounded-full h-9 w-9">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>

        {/* Mobile Nav */}
        <div className="flex sm:hidden items-center gap-2">
          {/* Market status indicator */}
          <div className={`h-2 w-2 rounded-full ${isMarketOpen ? "bg-gain animate-pulse" : "bg-loss"}`} />

          {hasActiveAccess && <AlertsPanel />}

          <Button variant="outline" size="icon" onClick={toggleTheme} className="rounded-full h-10 w-10" aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <span className="text-lg font-bold">Equity<span className="text-primary">Lens</span></span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                    <Activity className={`h-3 w-3 ${isMarketOpen ? "text-gain" : "text-loss"}`} />
                    {isMarketOpen ? "Market Open" : "Market Closed"}
                  </div>
                </div>

                <div className="flex-1 p-4 space-y-1">
                  {user && (
                    <button
                      onClick={() => { navigate("/profile"); closeMobileMenu(); }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-sm"
                    >
                      <User className="h-4 w-4 text-primary" />
                      <div className="flex-1 text-left">
                        <p className="font-medium truncate">{profile?.display_name || user.email}</p>
                        {isAdmin && (
                          <Badge variant="secondary" className="mt-0.5 px-1.5 py-0 text-[10px] font-semibold bg-primary/15 text-primary border-0">
                            <Shield className="h-2.5 w-2.5 mr-0.5" />
                            Admin
                          </Badge>
                        )}
                      </div>
                    </button>
                  )}

                  {hasActiveAccess && (
                    <button
                      onClick={() => { navigate("/portfolio"); closeMobileMenu(); }}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-sm"
                    >
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      Portfolio Dashboard
                    </button>
                  )}

                  {user && subscription?.status === 'trial' && (
                    <button
                      onClick={() => { navigate("/subscribe"); closeMobileMenu(); }}
                      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        trialDaysLeft <= 3 ? "text-destructive bg-destructive/5" : "text-amber-600 dark:text-amber-400 bg-amber-500/5"
                      }`}
                    >
                      <Clock className="h-4 w-4" />
                      {trialDaysLeft > 0 ? `${trialDaysLeft} days trial left` : "Trial expired"}
                    </button>
                  )}

                  {user && subscription?.plan === 'lifetime' && (
                    <div className="flex items-center gap-3 px-3 py-2.5 text-sm text-amber-600 dark:text-amber-400">
                      <Crown className="h-4 w-4" />
                      Lifetime Member
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-border space-y-2">
                  {user ? (
                    <Button variant="destructive" size="sm" className="w-full gap-2" onClick={() => { signOut(); closeMobileMenu(); }}>
                      <LogOut className="h-3.5 w-3.5" /> Sign Out
                    </Button>
                  ) : (
                    <Button size="sm" className="w-full gap-2" onClick={() => { navigate("/auth"); closeMobileMenu(); }}>
                      <LogIn className="h-3.5 w-3.5" /> Sign In
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.header>
  );
};

export default Header;
