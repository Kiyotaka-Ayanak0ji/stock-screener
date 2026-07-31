import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Loader2, RefreshCw, Star, AlertCircle } from "lucide-react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useFavourites } from "@/contexts/FavouritesContext";
import { fetchLivePrices } from "@/lib/growwApi";
import { getStockUrl } from "@/lib/stockData";

interface Quote {
  price: number;
  change: number;
  changePercent: number;
}

const fmt = (n: number) =>
  n > 0 ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

const Favourites = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { favourites, loading, error, removeFavourite, pendingTickers, refresh } = useFavourites();
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [pricesLoading, setPricesLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [authLoading, user, navigate]);

  const symbols = useMemo(
    () => favourites.map(f => ({
      ticker: f.ticker,
      exchange: (f.exchange === "BSE" ? "BSE" : "NSE") as "NSE" | "BSE",
      yahooSymbol: f.yahoo_symbol ?? undefined,
    })),
    [favourites],
  );

  const loadPrices = useMemo(() => async () => {
    if (symbols.length === 0) { setQuotes({}); return; }
    setPricesLoading(true);
    try {
      const data = await fetchLivePrices(symbols);
      const next: Record<string, Quote> = {};
      for (const [ticker, q] of Object.entries(data)) {
        if (!q) continue;
        const price = q.ltp ?? 0;
        const prev = q.close && q.close > 0 ? q.close : price;
        const change = price - prev;
        next[ticker] = {
          price,
          change,
          changePercent: prev > 0 ? (change / prev) * 100 : 0,
        };
      }
      setQuotes(next);
    } finally {
      setPricesLoading(false);
    }
  }, [symbols]);

  useEffect(() => { void loadPrices(); }, [loadPrices]);

  return (
    <div className="min-h-screen bg-background pb-bottom-nav">
      <Header />
      <main className="container mx-auto px-3 sm:px-4 py-5 sm:py-8 max-w-3xl">
        <div className="flex items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" aria-label="Back to dashboard" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                Favourites
              </h1>
              <p className="text-xs text-muted-foreground">
                {favourites.length} saved {favourites.length === 1 ? "stock" : "stocks"} · synced to your account
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => { void refresh(); void loadPrices(); }}
            disabled={pricesLoading || loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${pricesLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
            <AlertCircle className="h-5 w-5 text-destructive mx-auto" />
            <p className="mt-2 text-sm font-medium">Couldn't load your favourites</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => void refresh()}>Try again</Button>
          </div>
        ) : favourites.length === 0 ? (
          <div className="rounded-lg border border-border bg-card py-16 text-center">
            <Star className="h-6 w-6 text-muted-foreground mx-auto" />
            <p className="mt-3 text-sm font-medium">No favourites yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tap the star on any stock in your watchlist to save it here.
            </p>
            <Button size="sm" className="mt-4" onClick={() => navigate("/dashboard")}>Go to dashboard</Button>
          </div>
        ) : (
          <ul className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
            {favourites.map((f, i) => {
              const q = quotes[f.ticker];
              const up = (q?.change ?? 0) > 0;
              const down = (q?.change ?? 0) < 0;
              const busy = pendingTickers.has(f.ticker);
              return (
                <motion.li
                  key={f.ticker}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.2) }}
                  className="flex items-center gap-3 px-3 sm:px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-sm">{f.ticker}</span>
                      <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        {f.is_index ? "INDEX" : f.exchange}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{f.name || "—"}</p>
                  </div>

                  <div className="text-right shrink-0">
                    {pricesLoading && !q ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto" />
                    ) : (
                      <>
                        <p className="text-sm font-semibold tabular-nums">₹{fmt(q?.price ?? 0)}</p>
                        <p className={`text-xs tabular-nums ${up ? "text-gain" : down ? "text-loss" : "text-muted-foreground"}`}>
                          {q ? `${up ? "+" : ""}${q.changePercent.toFixed(2)}%` : "—"}
                        </p>
                      </>
                    )}
                  </div>

                  <a
                    href={getStockUrl(f.ticker, f.exchange, f.screener_code ?? undefined)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                    aria-label={`Open ${f.ticker} on Screener.in`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    disabled={busy}
                    aria-label={`Remove ${f.ticker} from favourites`}
                    onClick={() => void removeFavourite(f.ticker)}
                  >
                    {busy
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                  </Button>
                </motion.li>
              );
            })}
          </ul>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default Favourites;
