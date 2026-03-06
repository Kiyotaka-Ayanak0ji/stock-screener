import { Moon, Sun, Activity, TrendingUp } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useStocks } from "@/contexts/StockContext";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const Header = () => {
  const { theme, toggleTheme } = useTheme();
  const { stocks, isMarketOpen } = useStocks();

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
              Stock<span className="text-primary">Pulse</span>
            </h1>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 ml-4 px-3 py-1 rounded-full bg-secondary text-xs font-medium">
            <Activity className={`h-3 w-3 ${isMarketOpen ? "text-gain animate-pulse" : "text-loss"}`} />
            <span className="text-secondary-foreground">
              {isMarketOpen ? "Market Open" : "Market Closed"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 text-sm font-mono">
            <span className="text-gain">{gainers} ▲</span>
            <span className="text-loss">{losers} ▼</span>
            <span className="text-muted-foreground">{stocks.length - gainers - losers} —</span>
          </div>

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
