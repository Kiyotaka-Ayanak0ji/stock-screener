import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Plus, Search, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStocks } from "@/contexts/StockContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { ALL_AVAILABLE_STOCKS } from "@/lib/stockData";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import PremiumDialog from "@/components/PremiumDialog";

interface SearchResult {
  ticker: string;
  name: string;
  exchange: "NSE" | "BSE";
  isIndex?: boolean;
  yahooSymbol?: string;
  screenerCode?: string;
}

const AddStockDialog = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [screenerResults, setScreenerResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [premiumFeature, setPremiumFeature] = useState("");
  const { watchlist, addStock } = useStocks();
  const { isGuest } = useAuth();
  const { maxStocksPerWatchlist, isPro } = useSubscription();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stockLimit = isGuest ? 20 : maxStocksPerWatchlist;

  const localFiltered = useMemo(() => {
    if (!search.trim()) return ALL_AVAILABLE_STOCKS.filter(s => !watchlist.includes(s.ticker)).slice(0, 50);
    const q = search.toLowerCase();
    return ALL_AVAILABLE_STOCKS
      .filter(s => !watchlist.includes(s.ticker))
      .filter(s => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  }, [search, watchlist]);

  const merged = useMemo(() => {
    const seen = new Set<string>();
    const results: SearchResult[] = [];
    for (const s of localFiltered) {
      if (!seen.has(s.ticker)) { seen.add(s.ticker); results.push(s); }
    }
    for (const s of screenerResults) {
      if (!seen.has(s.ticker) && !watchlist.includes(s.ticker)) { seen.add(s.ticker); results.push(s); }
    }
    return results;
  }, [localFiltered, screenerResults, watchlist]);

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

  const handleAdd = (stock: SearchResult) => {
    if (watchlist.length >= stockLimit) {
      setPremiumFeature(`Adding more than ${stockLimit} stocks per watchlist`);
      setPremiumOpen(true);
      return;
    }
    addStock(stock.ticker, stock.name, stock.exchange, {
      yahooSymbol: stock.yahooSymbol,
      isIndex: stock.isIndex,
      screenerCode: stock.screenerCode,
    });
    setSearch("");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Stock
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Stock to Watchlist</DialogTitle>
            <p className="text-xs text-muted-foreground">
              {watchlist.length}/{stockLimit} stocks used
              {!isPro && !isGuest && " (upgrade for more)"}
            </p>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by ticker or company name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
            )}
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            <AnimatePresence>
              {merged.length === 0 && !isSearching ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No stocks found</p>
              ) : (
                merged.slice(0, 100).map(stock => (
                  <motion.button
                    key={stock.ticker}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    onClick={() => handleAdd(stock)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-md table-row-hover text-left"
                  >
                    <div>
                      <span className="font-mono font-semibold text-sm">{stock.ticker}</span>
                      <span className="text-muted-foreground text-xs ml-2">{stock.name}</span>
                    </div>
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {stock.isIndex ? "INDEX" : stock.exchange}
                    </span>
                  </motion.button>
                ))
              )}
            </AnimatePresence>
          </div>
          {search.trim().length >= 2 && (
            <p className="text-xs text-muted-foreground text-center">
              Powered by Screener.in • Showing all NSE & BSE stocks
            </p>
          )}
        </DialogContent>
      </Dialog>
      <PremiumDialog
        open={premiumOpen}
        onOpenChange={setPremiumOpen}
        featureName={premiumFeature}
      />
    </>
  );
};

export default AddStockDialog;
