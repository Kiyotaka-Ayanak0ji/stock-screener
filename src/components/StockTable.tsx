import { useState, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Filter } from "lucide-react";
import { useStocks } from "@/contexts/StockContext";
import StockRow from "@/components/StockRow";
import MobileStockCard from "@/components/MobileStockCard";
import AddStockDialog from "@/components/AddStockDialog";
import StockRowSkeleton from "@/components/StockRowSkeleton";
import ColumnVisibilityDropdown from "@/components/ColumnVisibilityDropdown";
import FilterPopover from "@/components/FilterPopover";
import FilterLockBadge from "@/components/FilterLockBadge";
import WatchlistManager from "@/components/WatchlistManager";
import ShareExportButton from "@/components/ShareExportButton";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowDownUp } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useIsMobile } from "@/hooks/use-mobile";
import PremiumDialog from "@/components/PremiumDialog";
type SortKey = "ticker" | "price" | "change" | "changePercent" | "volume" | "marketCap" | "pe" | "event" | string;
type SortDir = "asc" | "desc";

const StockTable = () => {
  const { isGuest } = useAuth();
  const { isPremium: isPremiumSub } = useSubscription();
  const isMobile = useIsMobile();
  const isPremium = !isGuest && isPremiumSub;
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

  const visibleCustomColumns = customColumns.filter(c => isVisible(`custom_${c.id}`));

  const activeFilterCount = isPremium
    ? [
        peFilterMin || peFilterMax,
        priceFilterMin || priceFilterMax,
        volumeFilterMin || volumeFilterMax,
        mcapFilterMin || mcapFilterMax,
      ].filter(Boolean).length
    : 0;

  const clearAllFilters = () => {
    setPeFilterMin(""); setPeFilterMax("");
    setPriceFilterMin(""); setPriceFilterMax("");
    setVolumeFilterMin(""); setVolumeFilterMax("");
    setMcapFilterMin(""); setMcapFilterMax("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="container mx-auto px-2 sm:px-4 py-4 sm:py-6"
    >
      {/* Title row — visible on all viewports */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 sm:mb-4 gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold leading-tight">
            {activeWatchlist ? activeWatchlist.name : "Live Watchlist"}
          </h2>
          <p className="text-[11px] sm:text-xs text-muted-foreground">
            {filtered.length !== stocks.length ? `${filtered.length} of ${stocks.length} stocks` : `${stocks.length} stocks`}
          </p>
        </div>
        {/* Desktop / tablet toolbar */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap">
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
                className="gap-1.5 text-xs px-3"
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

      {/* Mobile sticky compact toolbar — two rows for clarity */}
      <div className="sm:hidden sticky top-[49px] z-40 -mx-2 px-2 py-2 bg-background/95 backdrop-blur-md border-b border-border mb-3 space-y-2">
        {/* Row 1: market breadth + watchlist selector */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 text-[10px] font-mono px-2 py-1.5 rounded-md bg-secondary shrink-0">
            <span className="text-gain">{stocks.filter(s => s.change > 0).length}▲</span>
            <span className="text-loss">{stocks.filter(s => s.change < 0).length}▼</span>
            <span className="text-muted-foreground">{stocks.filter(s => s.change === 0).length}—</span>
          </div>
          <div className="flex-1 min-w-0">
            <WatchlistManager
              watchlists={userWatchlists}
              activeWatchlistId={activeWatchlistId}
              onSelect={setActiveWatchlistId}
              onCreate={createWatchlist}
              onRename={renameWatchlist}
              onDelete={deleteWatchlist}
            />
          </div>
        </div>

        {/* Row 2: action buttons, evenly distributed */}
        <div className="grid grid-cols-4 gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9 relative shrink-0"
                aria-label="Sort"
              >
                <ArrowDownUp className={`h-4 w-4 ${sortKey !== "ticker" || sortDir !== "asc" ? "text-primary" : ""}`} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs">Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {([
                { key: "ticker", label: "Ticker" },
                { key: "price", label: "Price" },
                { key: "changePercent", label: "Change %" },
                { key: "volume", label: "Volume" },
                { key: "marketCap", label: "Market Cap" },
              ] as { key: SortKey; label: string }[]).map((opt) => {
                const active = sortKey === opt.key;
                return (
                  <DropdownMenuItem
                    key={opt.key}
                    onClick={() => toggleSort(opt.key)}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className={active ? "font-semibold text-primary" : ""}>{opt.label}</span>
                    {active && (sortDir === "asc"
                      ? <ArrowUp className="h-3.5 w-3.5 text-primary" />
                      : <ArrowDown className="h-3.5 w-3.5 text-primary" />)}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9 relative shrink-0"
                aria-label="Filters"
                onClick={(e) => { if (!isPremium) { e.preventDefault(); setPremiumOpen(true); } }}
              >
                <Filter className={`h-4 w-4 ${activeFilterCount > 0 ? "text-primary" : ""}`} />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            {isPremium && (
              <PopoverContent align="end" className="w-72 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">Filters</p>
                  {activeFilterCount > 0 && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearAllFilters}>
                      Clear all
                    </Button>
                  )}
                </div>
                {[
                  { label: "Price", min: priceFilterMin, max: priceFilterMax, setMin: setPriceFilterMin, setMax: setPriceFilterMax },
                  { label: "Volume", min: volumeFilterMin, max: volumeFilterMax, setMin: setVolumeFilterMin, setMax: setVolumeFilterMax },
                  { label: "Market Cap", min: mcapFilterMin, max: mcapFilterMax, setMin: setMcapFilterMin, setMax: setMcapFilterMax },
                  { label: "P/E Ratio", min: peFilterMin, max: peFilterMax, setMin: setPeFilterMin, setMax: setPeFilterMax },
                ].map((f) => (
                  <div key={f.label} className="space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground">{f.label}</p>
                    <div className="flex items-center gap-2">
                      <Input type="number" inputMode="decimal" placeholder="Min" value={f.min} onChange={(e) => f.setMin(e.target.value)} className="h-9 text-xs" step="any" />
                      <span className="text-xs text-muted-foreground">—</span>
                      <Input type="number" inputMode="decimal" placeholder="Max" value={f.max} onChange={(e) => f.setMax(e.target.value)} className="h-9 text-xs" step="any" />
                    </div>
                  </div>
                ))}
              </PopoverContent>
            )}
          </Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                onClick={refreshPrices}
                disabled={isRefreshing}
                className="h-9 w-9 shrink-0"
                aria-label="Refresh prices"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh prices</TooltipContent>
          </Tooltip>
          <AddStockDialog />
        </div>
      </div>

      {/* Mobile Card View */}
      {isMobile ? (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {!pricesLoaded ? (
            <div className="space-y-0">
              {Array.from({ length: stocks.length || 4 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="border-b border-border px-3 py-3 animate-pulse">
                  <div className="flex justify-between">
                    <div className="space-y-2">
                      <div className="h-4 w-20 bg-muted rounded" />
                      <div className="h-3 w-32 bg-muted rounded" />
                    </div>
                    <div className="space-y-2 text-right">
                      <div className="h-4 w-16 bg-muted rounded ml-auto" />
                      <div className="h-4 w-20 bg-muted rounded ml-auto" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AnimatePresence>
              {sorted.map((stock, i) => (
                <MobileStockCard key={stock.ticker} stock={stock} index={i} priceLoading={!loadedTickers.has(stock.ticker)} />
              ))}
            </AnimatePresence>
          )}

          {stocks.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <p className="text-sm">No stocks in your watchlist</p>
              <p className="text-xs mt-1">Tap "Add Stock" to get started</p>
            </div>
          )}
        </div>
      ) : (
        /* Desktop Table View */
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
                        {isPremium
                          ? <FilterPopover label="Price" min={priceFilterMin} max={priceFilterMax} setMin={setPriceFilterMin} setMax={setPriceFilterMax} />
                          : <FilterLockBadge label="Price" onClick={() => setPremiumOpen(true)} />}
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
                      <div className="flex items-center justify-end gap-1">
                        Volume <SortIcon col="volume" />
                        {isPremium
                          ? <FilterPopover label="Volume" min={volumeFilterMin} max={volumeFilterMax} setMin={setVolumeFilterMin} setMax={setVolumeFilterMax} />
                          : <FilterLockBadge label="Volume" onClick={() => setPremiumOpen(true)} />}
                      </div>
                    </th>
                  )}
                  {isVisible("marketCap") && (
                    <th className={`${headerClass} text-right hidden md:table-cell`} onClick={() => toggleSort("marketCap")}>
                      <div className="flex items-center justify-end gap-1">
                        Market Cap <SortIcon col="marketCap" />
                        {isPremium
                          ? <FilterPopover label="Market Cap" min={mcapFilterMin} max={mcapFilterMax} setMin={setMcapFilterMin} setMax={setMcapFilterMax} />
                          : <FilterLockBadge label="Market Cap" onClick={() => setPremiumOpen(true)} />}
                      </div>
                    </th>
                  )}
                  {isVisible("pe") && (
                    <th className={`${headerClass} text-right hidden md:table-cell`} onClick={() => toggleSort("pe")}>
                      <div className="flex items-center justify-end gap-1">
                        P/E <SortIcon col="pe" />
                        {isPremium
                          ? <FilterPopover label="P/E Ratio" min={peFilterMin} max={peFilterMax} setMin={setPeFilterMin} setMax={setPeFilterMax} />
                          : <FilterLockBadge label="P/E Ratio" onClick={() => setPremiumOpen(true)} />}
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
      )}

      <p className="text-xs text-muted-foreground mt-3 text-center">
        · Preferences encrypted &amp; synced
      </p>
      <PremiumDialog open={premiumOpen} onOpenChange={setPremiumOpen} featureName="P/E Ratio" />
    </motion.div>
  );
};

export default StockTable;
