import { motion } from "framer-motion";
import { useStocks } from "@/contexts/StockContext";
import { TrendingUp, TrendingDown, BarChart3, Activity, ArrowUpRight, ArrowDownRight, Minus, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DailySummaryCard = () => {
  const { stocks, isMarketOpen } = useStocks();

  const gainers = stocks.filter(s => s.change > 0).sort((a, b) => b.changePercent - a.changePercent);
  const losers = stocks.filter(s => s.change < 0).sort((a, b) => a.changePercent - b.changePercent);
  const unchanged = stocks.filter(s => s.change === 0);

  const totalValue = stocks.reduce((sum, s) => sum + s.marketCap, 0);
  const avgChange = stocks.length > 0
    ? stocks.reduce((sum, s) => sum + s.changePercent, 0) / stocks.length
    : 0;

  const totalVolume = stocks.reduce((sum, s) => sum + s.volume, 0);
  const topGainer = gainers[0];
  const topLoser = losers[0];

  const formatVolume = (v: number) => {
    if (v >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
    if (v >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return v.toString();
  };

  const formatMarketCap = (v: number) => {
    if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L Cr`;
    if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}K Cr`;
    return `₹${v.toFixed(0)} Cr`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-border bg-card/60 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Daily Briefing</h3>
                <p className="text-[10px] text-muted-foreground">
                  {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                  {" · "}
                  {isMarketOpen ? "Live" : "Closing data"}
                </p>
              </div>
            </div>
            <Badge
              variant="secondary"
              className={`text-[10px] px-2 py-0.5 ${
                avgChange >= 0
                  ? "bg-gain/10 text-gain border-gain/20"
                  : "bg-loss/10 text-loss border-loss/20"
              }`}
            >
              {avgChange >= 0 ? "+" : ""}{avgChange.toFixed(2)}% avg
            </Badge>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="rounded-lg bg-gain/5 border border-gain/10 p-2.5"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowUpRight className="h-3 w-3 text-gain" />
                <span className="text-[10px] font-medium text-gain">Gainers</span>
              </div>
              <p className="text-lg font-bold font-mono text-gain">{gainers.length}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              className="rounded-lg bg-loss/5 border border-loss/10 p-2.5"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowDownRight className="h-3 w-3 text-loss" />
                <span className="text-[10px] font-medium text-loss">Losers</span>
              </div>
              <p className="text-lg font-bold font-mono text-loss">{losers.length}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="rounded-lg bg-secondary border border-border p-2.5"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">Volume</span>
              </div>
              <p className="text-lg font-bold font-mono text-foreground">{formatVolume(totalVolume)}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 }}
              className="rounded-lg bg-secondary border border-border p-2.5"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <BarChart3 className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">Mkt Cap</span>
              </div>
              <p className="text-lg font-bold font-mono text-foreground">{formatMarketCap(totalValue)}</p>
            </motion.div>
          </div>

          {/* Top Movers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topGainer && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-3 rounded-lg bg-gain/5 border border-gain/10 p-3"
              >
                <div className="h-9 w-9 rounded-full bg-gain/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-4 w-4 text-gain" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-gain uppercase tracking-wider">Top Gainer</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold font-mono text-foreground truncate">{topGainer.ticker}</span>
                    <span className="text-xs font-mono text-gain font-semibold">
                      +{topGainer.changePercent.toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    ₹{topGainer.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </motion.div>
            )}

            {topLoser && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 }}
                className="flex items-center gap-3 rounded-lg bg-loss/5 border border-loss/10 p-3"
              >
                <div className="h-9 w-9 rounded-full bg-loss/10 flex items-center justify-center shrink-0">
                  <TrendingDown className="h-4 w-4 text-loss" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-loss uppercase tracking-wider">Top Loser</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold font-mono text-foreground truncate">{topLoser.ticker}</span>
                    <span className="text-xs font-mono text-loss font-semibold">
                      {topLoser.changePercent.toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    ₹{topLoser.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </motion.div>
            )}
          </div>

          {/* Change Distribution Bar */}
          {stocks.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-4"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] text-muted-foreground">Market Breadth</span>
                <div className="flex-1" />
                <span className="text-[10px] font-mono text-gain">{gainers.length}</span>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[10px] font-mono text-unchanged">{unchanged.length}</span>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[10px] font-mono text-loss">{losers.length}</span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(gainers.length / stocks.length) * 100}%` }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className="bg-gain rounded-l-full"
                />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(unchanged.length / stocks.length) * 100}%` }}
                  transition={{ delay: 0.55, duration: 0.6 }}
                  className="bg-muted-foreground/30"
                />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(losers.length / stocks.length) * 100}%` }}
                  transition={{ delay: 0.6, duration: 0.6 }}
                  className="bg-loss rounded-r-full"
                />
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default DailySummaryCard;
