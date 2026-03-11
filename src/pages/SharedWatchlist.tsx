import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, ArrowLeft, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface SharedStock {
  ticker: string;
  name: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  marketCap: number;
}

interface SharedData {
  watchlist_name: string;
  stock_data: SharedStock[];
  created_at: string;
}

const formatNumber = (n: number) => {
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(2)} L`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)} K`;
  return n.toFixed(2);
};

const SharedWatchlist = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid share link");
      setLoading(false);
      return;
    }

    const fetchShared = async () => {
      const { data: row, error: err } = await supabase
        .from("shared_watchlists")
        .select("watchlist_name, stock_data, created_at")
        .eq("share_token", token)
        .single();

      if (err || !row) {
        setError("This shared watchlist was not found or has expired.");
        setLoading(false);
        return;
      }

      setData({
        watchlist_name: row.watchlist_name,
        stock_data: (row.stock_data as SharedStock[]) || [],
        created_at: row.created_at,
      });
      setLoading(false);
    };

    fetchShared();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading shared watchlist...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => navigate("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Go Home
        </Button>
      </div>
    );
  }

  const sharedDate = new Date(data.created_at).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">
              Stock<span className="text-primary">Pulse</span>
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/")} className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </Button>
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="container mx-auto px-4 py-6"
      >
        <div className="mb-4">
          <h2 className="text-lg font-bold">{data.watchlist_name}</h2>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            Shared on {sharedDate} · {data.stock_data.length} stocks
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-left">Ticker</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-left">Exchange</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Price</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Change</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right hidden md:table-cell">High</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right hidden md:table-cell">Low</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right hidden lg:table-cell">Volume</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right hidden lg:table-cell">Market Cap</th>
                </tr>
              </thead>
              <tbody>
                {data.stock_data.map((stock, i) => (
                  <tr
                    key={stock.ticker}
                    className={`border-b border-border/50 ${i % 2 === 0 ? "bg-background" : "bg-muted/20"}`}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-mono font-semibold text-sm">{stock.ticker}</span>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">{stock.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{stock.exchange}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-medium">
                      ₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono text-sm ${stock.change >= 0 ? "text-gain" : "text-loss"}`}>
                        {stock.change >= 0 ? "+" : ""}{stock.change.toFixed(2)} ({stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm hidden md:table-cell">₹{stock.high.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm hidden md:table-cell">₹{stock.low.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs hidden lg:table-cell">{formatNumber(stock.volume)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs hidden lg:table-cell">{formatNumber(stock.marketCap)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3 text-center">
          This is a snapshot of the watchlist at the time it was shared. Prices may have changed.
        </p>
      </motion.div>
    </div>
  );
};

export default SharedWatchlist;
