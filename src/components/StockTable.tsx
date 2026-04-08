import { useState, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Filter } from "lucide-react";
import { useStocks } from "@/contexts/StockContext";
import StockRow from "@/components/StockRow";
import AddStockDialog from "@/components/AddStockDialog";
import StockRowSkeleton from "@/components/StockRowSkeleton";
import ColumnVisibilityDropdown from "@/components/ColumnVisibilityDropdown";
import WatchlistManager from "@/components/WatchlistManager";
import ShareExportButton from "@/components/ShareExportButton";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSubscription } from "@/hooks/useSubscription";
import PremiumDialog from "@/components/PremiumDialog";
type SortKey = "ticker" | "price" | "change" | "changePercent" | "volume" | "marketCap" | "pe" | "event" | string;
type SortDir = "asc" | "desc";

const StockTable = () => {
  const { user, isGuest } = useAuth();
  const { subscription } = useSubscription();
  const isPremium = !isGuest && (subscription?.plan === "premium_monthly" || subscription?.plan === "yearly" || subscription?.plan === "annual" || subscription?.plan === "lifetime") && (subscription?.status === "active");
  const {
    stocks, events, columnVisibility, customColumns, customColumnData,
    refreshPrices, isRefreshing, pricesLoaded, loadedTickers,
    userWatchlists, activeWatchlist, activeWatchlistId, setActiveWatchlistId,
    createWatchlist, renameWatchlist, deleteWatchlist,
  } = useStocks();
  const tableRef = useRef<HTMLDivElement>(null);
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [peFilterMin, setPeFilterMin] = useState<string>("");
  const [peFilterMax, setPeFilterMax] = useState<string>("");
  const [priceFilterMin, setPriceFilterMin] = useState<string>("");
  const [priceFilterMax, setPriceFilterMax] = useState<string>("");
  const [volumeFilterMin, setVolumeFilterMin] = useState<string>("");
  const [volumeFilterMax, setVolumeFilterMax] = useState<string>("");
  const [mcapFilterMin, setMcapFilterMin] = useState<string>("");
  const [mcapFilterMax, setMcapFilterMax] = useState<string>("");
  const [premiumOpen, setPremiumOpen] = useState(false);

  const isVisible = (key: string) => columnVisibility[key] !== false;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(prev => prev === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "ticker" ? "asc" : "desc"); }
  };

  const applyRange = (value: number, min: string, max: string) => {
    const lo = min ? parseFloat(min) : null;
    const hi = max ? parseFloat(max) : null;
    if (lo !== null && value < lo) return false;
    if (hi !== null && value > hi) return false;
    return true;
  };

  const filtered = useMemo(() => {
    let list = [...stocks];
    if (isPremium) {
      if (isVisible("pe") && (peFilterMin || peFilterMax)) {
        list = list.filter(s => s.pe > 0 && applyRange(s.pe, peFilterMin, peFilterMax));
      }
      if (isVisible("price") && (priceFilterMin || priceFilterMax)) {
        list = list.filter(s => applyRange(s.price, priceFilterMin, priceFilterMax));
      }
      if (isVisible("volume") && (volumeFilterMin || volumeFilterMax)) {
        list = list.filter(s => applyRange(s.volume, volumeFilterMin, volumeFilterMax));
      }
      if (isVisible("marketCap") && (mcapFilterMin || mcapFilterMax)) {
        list = list.filter(s => applyRange(s.marketCap, mcapFilterMin, mcapFilterMax));
      }
    }
    return list;
  }, [stocks, isPremium, peFilterMin, peFilterMax, priceFilterMin, priceFilterMax, volumeFilterMin, volumeFilterMax, mcapFilterMin, mcapFilterMax, columnVisibility]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "ticker": cmp = a.ticker.localeCompare(b.ticker); break;
        case "price": cmp = a.price - b.price; break;
        case "change": cmp = a.change - b.change; break;
        case "changePercent": cmp = a.changePercent - b.changePercent; break;
        case "volume": cmp = a.volume - b.volume; break;
        case "marketCap": cmp = a.marketCap - b.marketCap; break;
        case "pe": cmp = (a.pe || 0) - (b.pe || 0); break;
        case "event": {
          const aEvent = events.find(e => e.ticker === a.ticker)?.tags?.join(",") || "";
          const bEvent = events.find(e => e.ticker === b.ticker)?.tags?.join(",") || "";
          cmp = aEvent.localeCompare(bEvent);
          break;
        }
        default: {
          if (sortKey.startsWith("custom_")) {
            const colId = sortKey.replace("custom_", "");
            const aVal = customColumnData[a.ticker]?.[colId] ?? -Infinity;
            const bVal = customColumnData[b.ticker]?.[colId] ?? -Infinity;
            cmp = (aVal as number) - (bVal as number);
          }
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [stocks, sortKey, sortDir, events, customColumnData]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const headerClass = "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors";

  const FilterPopover = ({ label, min, max, setMin, setMax }: { label: string; min: string; max: string; setMin: (v: string) => void; setMax: (v: string) => void }) => (
    <Popover>
      <PopoverTrigger asChild onClick={e => e.stopPropagation()}>
        <button className="ml-0.5 hover:text-primary transition-colors">
          <Filter className={`h-3 w-3 ${min || max ? "text-primary" : "opacity-40"}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-3" align="end" onClick={e => e.stopPropagation()}>
        <p className="text-xs font-medium mb-2">Filter by {label}</p>
        <div className="flex items-center gap-2">
          <Input type="number" placeholder="Min" value={min} onChange={e => setMin(e.target.value)} className="h-7 text-xs" step="any" />
          <span className="text-xs text-muted-foreground">—</span>
          <Input type="number" placeholder="Max" value={max} onChange={e => setMax(e.target.value)} className="h-7 text-xs" step="any" />
        </div>
        {(min || max) && (
          <Button size="sm" variant="ghost" className="w-full mt-2 text-xs h-7" onClick={() => { setMin(""); setMax(""); }}>
            Clear Filter
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );

  const visibleCustomColumns = customColumns.filter(c => isVisible(`custom_${c.id}`));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="container mx-auto px-4 py-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">
            {activeWatchlist ? activeWatchlist.name : "Live Watchlist"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {filtered.length !== stocks.length ? `${filtered.length} of ${stocks.length} stocks` : `${stocks.length} stocks`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 text-xs font-mono px-2 py-1 rounded-md bg-secondary">
            <span className="text-gain">{stocks.filter(s => s.change > 0).length} ▲</span>
            <span className="text-loss">{stocks.filter(s => s.change < 0).length} ▼</span>
            <span className="text-muted-foreground">{stocks.filter(s => s.change === 0).length} —</span>
          </div>
          <WatchlistManager
            watchlists={userWatchlists}
            activeWatchlistId={activeWatchlistId}
            onSelect={setActiveWatchlistId}
            onCreate={createWatchlist}
            onRename={renameWatchlist}
            onDelete={deleteWatchlist}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={refreshPrices}
                disabled={isRefreshing}
                className="gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fetch latest prices for all stocks</TooltipContent>
          </Tooltip>
          <ShareExportButton tableRef={tableRef} />
          <ColumnVisibilityDropdown />
          <AddStockDialog />
        </div>
      </div>

      <div ref={tableRef} className="rounded-lg border border-border bg-card glow-primary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className={headerClass} onClick={() => toggleSort("ticker")}>
                  <div className="flex items-center gap-1">Ticker <SortIcon col="ticker" /></div>
                </th>
                {isVisible("exchange") && (
                  <th className={headerClass}>Exchange</th>
                )}
                {isVisible("price") && (
                  <th className={`${headerClass} text-right`} onClick={() => toggleSort("price")}>
                    <div className="flex items-center justify-end gap-1">
                      Price <SortIcon col="price" />
                      {isPremium && <FilterPopover label="Price" min={priceFilterMin} max={priceFilterMax} setMin={setPriceFilterMin} setMax={setPriceFilterMax} />}
                    </div>
                  </th>
                )}
                {isVisible("change") && (
                  <th className={`${headerClass} text-right`} onClick={() => toggleSort("changePercent")}>
                    <div className="flex items-center justify-end gap-1">Change <SortIcon col="changePercent" /></div>
                  </th>
                )}
                {isVisible("high") && (
                  <th className={`${headerClass} text-right hidden lg:table-cell`}>High</th>
                )}
                {isVisible("low") && (
                  <th className={`${headerClass} text-right hidden lg:table-cell`}>Low</th>
                )}
                {isVisible("volume") && (
                  <th className={`${headerClass} text-right hidden md:table-cell`} onClick={() => toggleSort("volume")}>
                    <div className="flex items-center justify-end gap-1">Volume <SortIcon col="volume" /></div>
                  </th>
                )}
                {isVisible("marketCap") && (
                  <th className={`${headerClass} text-right hidden md:table-cell`} onClick={() => toggleSort("marketCap")}>
                    <div className="flex items-center justify-end gap-1">Market Cap <SortIcon col="marketCap" /></div>
                  </th>
                )}
                {isVisible("pe") && (
                  <th className={`${headerClass} text-right hidden md:table-cell`} onClick={() => toggleSort("pe")}>
                    <div className="flex items-center justify-end gap-1">
                      P/E <SortIcon col="pe" />
                      {isPremium && (
                        <Popover>
                          <PopoverTrigger asChild onClick={e => e.stopPropagation()}>
                            <button className="ml-0.5 hover:text-primary transition-colors">
                              <Filter className={`h-3 w-3 ${peFilterMin || peFilterMax ? "text-primary" : "opacity-40"}`} />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-52 p-3" align="end" onClick={e => e.stopPropagation()}>
                            <p className="text-xs font-medium mb-2">Filter by P/E Ratio</p>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                placeholder="Min"
                                value={peFilterMin}
                                onChange={e => setPeFilterMin(e.target.value)}
                                className="h-7 text-xs"
                                step="any"
                              />
                              <span className="text-xs text-muted-foreground">—</span>
                              <Input
                                type="number"
                                placeholder="Max"
                                value={peFilterMax}
                                onChange={e => setPeFilterMax(e.target.value)}
                                className="h-7 text-xs"
                                step="any"
                              />
                            </div>
                            {(peFilterMin || peFilterMax) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="w-full mt-2 text-xs h-7"
                                onClick={() => { setPeFilterMin(""); setPeFilterMax(""); }}
                              >
                                Clear Filter
                              </Button>
                            )}
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </th>
                )}
                {visibleCustomColumns.map(col => (
                  <th key={col.id} className={`${headerClass} text-right`} onClick={() => toggleSort(`custom_${col.id}`)}>
                    <div className="flex items-center justify-end gap-1">{col.name} <SortIcon col={`custom_${col.id}`} /></div>
                  </th>
                ))}
                {isVisible("priceTrigger") && (
                  <th className={`${headerClass} text-right`}>
                    <div className="flex items-center justify-end gap-1">Price Trigger</div>
                  </th>
                )}
                {isVisible("event") && (
                  <th className={headerClass} onClick={() => toggleSort("event")}>
                    <div className="flex items-center gap-1">Event <SortIcon col="event" /></div>
                  </th>
                )}
                {isVisible("notes") && (
                  <th className={headerClass}>Notes</th>
                )}
                <th className={`${headerClass} w-10`}></th>
              </tr>
            </thead>
            <tbody>
              {!pricesLoaded ? (
                <>
                  {Array.from({ length: stocks.length || 4 }).map((_, i) => (
                    <StockRowSkeleton
                      key={`skeleton-${i}`}
                      index={i}
                      columnVisibility={columnVisibility}
                      customColumnCount={visibleCustomColumns.length}
                    />
                  ))}
                </>
              ) : (
                <AnimatePresence>
                  {sorted.map((stock, i) => (
                    <StockRow key={stock.ticker} stock={stock} index={i} visibleCustomColumns={visibleCustomColumns} priceLoading={!loadedTickers.has(stock.ticker)} />
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {stocks.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-sm">No stocks in your watchlist</p>
            <p className="text-xs mt-1">Click "Add Stock" to get started</p>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-3 text-center">
        · Preferences encrypted &amp; synced
      </p>
      <PremiumDialog open={premiumOpen} onOpenChange={setPremiumOpen} featureName="P/E Ratio" />
    </motion.div>
  );
};

export default StockTable;
