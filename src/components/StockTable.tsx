import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { useStocks } from "@/contexts/StockContext";
import StockRow from "@/components/StockRow";
import AddStockDialog from "@/components/AddStockDialog";
import ColumnVisibilityDropdown from "@/components/ColumnVisibilityDropdown";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
type SortKey = "ticker" | "price" | "change" | "changePercent" | "volume" | "marketCap" | "event" | string;
type SortDir = "asc" | "desc";

const StockTable = () => {
  const { stocks, events, columnVisibility, customColumns, customColumnData } = useStocks();
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const isVisible = (key: string) => columnVisibility[key] !== false;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(prev => prev === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "ticker" ? "asc" : "desc"); }
  };

  const sorted = useMemo(() => {
    return [...stocks].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "ticker": cmp = a.ticker.localeCompare(b.ticker); break;
        case "price": cmp = a.price - b.price; break;
        case "change": cmp = a.change - b.change; break;
        case "changePercent": cmp = a.changePercent - b.changePercent; break;
        case "volume": cmp = a.volume - b.volume; break;
        case "marketCap": cmp = a.marketCap - b.marketCap; break;
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="container mx-auto px-4 py-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">Live Watchlist</h2>
          <p className="text-xs text-muted-foreground">
            {stocks.length} stocks · Auto-refreshing every 2s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ColumnVisibilityDropdown />
          <AddStockDialog />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card glow-primary overflow-hidden">
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
                    <div className="flex items-center justify-end gap-1">Price <SortIcon col="price" /></div>
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
                {visibleCustomColumns.map(col => (
                  <th key={col.id} className={`${headerClass} text-right`} onClick={() => toggleSort(`custom_${col.id}`)}>
                    <div className="flex items-center justify-end gap-1">{col.name} <SortIcon col={`custom_${col.id}`} /></div>
                  </th>
                ))}
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
              <AnimatePresence>
                {sorted.map((stock, i) => (
                  <StockRow key={stock.ticker} stock={stock} index={i} visibleCustomColumns={visibleCustomColumns} />
                ))}
              </AnimatePresence>
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
        Live data via Groww API · Prices refresh every 5 seconds · Preferences encrypted &amp; synced
      </p>
    </motion.div>
  );
};

export default StockTable;
