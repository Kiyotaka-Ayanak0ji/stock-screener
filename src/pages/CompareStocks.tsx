import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, X, Loader2, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useTheme } from "@/contexts/ThemeContext";
import { ALL_AVAILABLE_STOCKS, Stock } from "@/lib/stockData";
import { fetchLivePrices, applyLiveData } from "@/lib/growwApi";
import { supabase } from "@/integrations/supabase/client";
import { Moon, Sun } from "lucide-react";
import PremiumDialog from "@/components/PremiumDialog";

const MAX_COMPARE = 3;

interface SearchResult {
  ticker: string;
  name: string;
  exchange: "NSE" | "BSE";
  isIndex?: boolean;
  yahooSymbol?: string;
  screenerCode?: string;
}

function formatNumber(num: number): string {
  if (num >= 1e7) return `${(num / 1e7).toFixed(2)} Cr`;
  if (num >= 1e5) return `${(num / 1e5).toFixed(2)} L`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString("en-IN");
}

function formatPrice(num: number): string {
  return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const CompareStocks = () => {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const { isActive, loading: subLoading } = useSubscription();
  const { theme, toggleTheme } = useTheme();

  const [selectedStocks, setSelectedStocks] = useState<Stock[]>([]);
  const [loadingStocks, setLoadingStocks] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [screenerResults, setScreenerResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { subscription } = useSubscription();
  const isPremiumPlan = subscription?.plan === "yearly" || subscription?.plan === "annual" || subscription?.plan === "lifetime";

  // Premium gate: only yearly/annual/lifetime can access comparison
  useEffect(() => {
    if (!subLoading && !isPremiumPlan) {
      setPremiumOpen(true);
    }
  }, [subLoading, isPremiumPlan]);

  const selectedTickers = useMemo(() => new Set(selectedStocks.map(s => s.ticker)), [selectedStocks]);

  const localFiltered = useMemo(() => {
    if (!search.trim()) return ALL_AVAILABLE_STOCKS.filter(s => !selectedTickers.has(s.ticker)).slice(0, 30);
    const q = search.toLowerCase();
    return ALL_AVAILABLE_STOCKS
      .filter(s => !selectedTickers.has(s.ticker))
      .filter(s => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  }, [search, selectedTickers]);

  useEffect(() => {
    if (!search.trim() || search.trim().length < 2) { setScreenerResults([]); return; }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data, error } = await supabase.functions.invoke("screener-search", { body: { query: search.trim() } });
        if (!error && data?.results) setScreenerResults(data.results);
      } catch (err) { console.error("Screener search failed:", err); }
      finally { setIsSearching(false); }
    }, 400);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [search]);

  const merged = useMemo(() => {
    const seen = new Set<string>();
    const results: SearchResult[] = [];
    for (const s of localFiltered) {
      if (!seen.has(s.ticker)) { seen.add(s.ticker); results.push(s); }
    }
    for (const s of screenerResults) {
      if (!seen.has(s.ticker) && !selectedTickers.has(s.ticker)) { seen.add(s.ticker); results.push(s); }
    }
    return results;
  }, [localFiltered, screenerResults, selectedTickers]);

  const handleSelectStock = async (stock: SearchResult) => {
    if (selectedStocks.length >= MAX_COMPARE && activeSlot === null) return;

    setLoadingStocks(prev => new Set(prev).add(stock.ticker));
    setSearch("");
    setActiveSlot(null);

    try {
      const liveData = await fetchLivePrices([{ ticker: stock.ticker, exchange: stock.exchange }]);
      const baseStock: Stock = {
        ticker: stock.ticker,
        name: stock.name,
        exchange: stock.exchange,
        price: 0,
        previousClose: 0,
        change: 0,
        changePercent: 0,
        high: 0,
        low: 0,
        open: 0,
        volume: 0,
        marketCap: 0,
        lastUpdated: new Date(),
      };
      const quote = liveData[stock.ticker];
      const finalStock = quote ? applyLiveData(baseStock, quote) : baseStock;

      setSelectedStocks(prev => {
        if (activeSlot !== null && activeSlot < prev.length) {
          const updated = [...prev];
          updated[activeSlot] = finalStock;
          return updated;
        }
        return [...prev, finalStock];
      });
    } catch {
      // Fallback with base data
      const baseStock: Stock = {
        ticker: stock.ticker,
        name: stock.name,
        exchange: stock.exchange,
        price: 0,
        previousClose: 0,
        change: 0,
        changePercent: 0,
        high: 0,
        low: 0,
        open: 0,
        volume: 0,
        marketCap: 0,
        lastUpdated: new Date(),
      };
      setSelectedStocks(prev => {
        if (activeSlot !== null && activeSlot < prev.length) {
          const updated = [...prev];
          updated[activeSlot] = baseStock;
          return updated;
        }
        return [...prev, baseStock];
      });
    } finally {
      setLoadingStocks(prev => {
        const next = new Set(prev);
        next.delete(stock.ticker);
        return next;
      });
    }
  };

  const removeStock = (index: number) => {
    setSelectedStocks(prev => prev.filter((_, i) => i !== index));
  };

  const metrics: { label: string; key: string; format: (stock: Stock) => string; compare?: "higher" | "lower" }[] = [
    { label: "Current Price", key: "price", format: s => formatPrice(s.price) },
    { label: "Change", key: "change", format: s => `${s.change >= 0 ? "+" : ""}${s.change.toFixed(2)}` },
    { label: "Change %", key: "changePercent", format: s => `${s.changePercent >= 0 ? "+" : ""}${s.changePercent.toFixed(2)}%` },
    { label: "Day High", key: "high", format: s => formatPrice(s.high), compare: "higher" },
    { label: "Day Low", key: "low", format: s => formatPrice(s.low), compare: "lower" },
    { label: "Open", key: "open", format: s => formatPrice(s.open) },
    { label: "Prev Close", key: "previousClose", format: s => formatPrice(s.previousClose) },
    { label: "Volume", key: "volume", format: s => formatNumber(s.volume), compare: "higher" },
    { label: "Market Cap", key: "marketCap", format: s => formatNumber(s.marketCap), compare: "higher" },
  ];

  const getBestIndex = (key: string, compare?: "higher" | "lower") => {
    if (!compare || selectedStocks.length < 2) return -1;
    const values = selectedStocks.map(s => (s as any)[key] as number);
    if (values.every(v => v === 0)) return -1;
    const best = compare === "higher" ? Math.max(...values) : Math.min(...values);
    return values.indexOf(best);
  };

  if (subLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold tracking-tight">Compare Stocks</h1>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={toggleTheme} className="rounded-full h-9 w-9">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Stock slots */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {Array.from({ length: MAX_COMPARE }).map((_, i) => {
            const stock = selectedStocks[i];
            const isLoading = stock ? loadingStocks.has(stock.ticker) : false;

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                {stock ? (
                  <Card className="relative group">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">{stock.ticker}</p>
                          <p className="text-xs text-muted-foreground truncate">{stock.name}</p>
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mt-2 text-primary" />
                          ) : (
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="text-lg font-semibold text-foreground">{formatPrice(stock.price)}</span>
                              <span className={`text-xs font-medium ${stock.change >= 0 ? "text-gain" : "text-loss"}`}>
                                {stock.change >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%
                              </span>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeStock(i)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-3 text-xs"
                        onClick={() => { setActiveSlot(i); }}
                      >
                        Replace
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card
                    className="border-dashed cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setActiveSlot(i)}
                  >
                    <CardContent className="p-4 flex flex-col items-center justify-center min-h-[120px] text-muted-foreground">
                      <Search className="h-5 w-5 mb-2" />
                      <p className="text-sm">Add Stock {i + 1}</p>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Search panel */}
        <AnimatePresence>
          {activeSlot !== null && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {selectedStocks[activeSlot] ? "Replace" : "Select"} Stock {activeSlot + 1}
                    </CardTitle>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setActiveSlot(null); setSearch(""); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by ticker or company name..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-9"
                      autoFocus
                    />
                    {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {merged.slice(0, 20).map(stock => (
                      <button
                        key={stock.ticker}
                        onClick={() => handleSelectStock(stock)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors text-left"
                      >
                        <div>
                          <span className="font-medium text-foreground">{stock.ticker}</span>
                          <span className="ml-2 text-muted-foreground text-xs">{stock.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] px-1.5">{stock.exchange}</Badge>
                      </button>
                    ))}
                    {merged.length === 0 && !isSearching && search.trim() && (
                      <p className="text-sm text-muted-foreground text-center py-4">No stocks found</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Comparison table */}
        {selectedStocks.length >= 2 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Side-by-Side Comparison
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 text-muted-foreground font-medium w-[140px]">Metric</th>
                        {selectedStocks.map((stock, i) => (
                          <th key={i} className="text-right p-3 font-semibold text-foreground">
                            {stock.ticker}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.map((metric, mi) => {
                        const bestIdx = getBestIndex(metric.key, metric.compare);
                        return (
                          <tr key={metric.key} className={mi % 2 === 0 ? "bg-muted/30" : ""}>
                            <td className="p-3 text-muted-foreground font-medium">{metric.label}</td>
                            {selectedStocks.map((stock, si) => {
                              const isChange = metric.key === "change" || metric.key === "changePercent";
                              const isBest = bestIdx === si;
                              return (
                                <td
                                  key={si}
                                  className={`p-3 text-right font-mono ${
                                    isChange
                                      ? stock.change >= 0
                                        ? "text-gain"
                                        : "text-loss"
                                      : isBest
                                      ? "text-primary font-semibold"
                                      : "text-foreground"
                                  }`}
                                >
                                  <div className="flex items-center justify-end gap-1">
                                    {isChange && (
                                      stock.change > 0 ? <TrendingUp className="h-3 w-3" /> :
                                      stock.change < 0 ? <TrendingDown className="h-3 w-3" /> :
                                      <Minus className="h-3 w-3" />
                                    )}
                                    {metric.format(stock)}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {selectedStocks.length < 2 && (
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Select at least 2 stocks to compare</p>
            <p className="text-sm mt-1">Click the slots above to search and add stocks</p>
          </div>
        )}
      </div>

      <PremiumDialog
        open={premiumOpen}
        onOpenChange={(open) => {
          setPremiumOpen(open);
          if (!open && (isGuest || !isActive)) navigate("/dashboard");
        }}
        featureName="Stock Comparison"
      />
    </div>
  );
};

export default CompareStocks;
