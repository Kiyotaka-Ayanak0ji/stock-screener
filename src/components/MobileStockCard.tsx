import { useState } from "react";
import { Stock, getStockUrl } from "@/lib/stockData";
import { useStocks } from "@/contexts/StockContext";
import { ExternalLink, Bell, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import StockDetailSheet from "@/components/StockDetailSheet";

interface MobileStockCardProps {
  stock: Stock;
  index: number;
  priceLoading?: boolean;
}

const MobileStockCard = ({ stock, index, priceLoading }: MobileStockCardProps) => {
  const { priceTriggers } = useStocks();
  const [detailOpen, setDetailOpen] = useState(false);

  const isPriceAvailable = !priceLoading || stock.price !== 0;
  const isPositive = stock.change > 0;
  const isNegative = stock.change < 0;
  const changeColor = isPositive ? "text-gain" : isNegative ? "text-loss" : "text-muted-foreground";
  const changeBg = isPositive ? "bg-gain/10" : isNegative ? "bg-loss/10" : "bg-muted";
  const trigger = priceTriggers[stock.ticker];

  const formatVolume = (v: number) => {
    if (v >= 10000000) return (v / 10000000).toFixed(2) + " Cr";
    if (v >= 100000) return (v / 100000).toFixed(2) + " L";
    if (v >= 1000) return (v / 1000).toFixed(1) + "K";
    return v.toString();
  };

  const formatMarketCap = (v: number) => {
    if (!v || v <= 0) return "—";
    if (v >= 100000) return "₹" + (v / 100000).toFixed(2) + " L Cr";
    if (v >= 1000) return "₹" + (v / 1000).toFixed(2) + " K Cr";
    return "₹" + v.toFixed(0) + " Cr";
  };

  const handleOpen = () => setDetailOpen(true);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ delay: index * 0.02, duration: 0.25 }}
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpen();
          }
        }}
        aria-label={`Open details for ${stock.ticker}`}
        className="border-b border-border px-4 py-3.5 active:bg-muted/50 transition-all duration-150 hover:bg-muted/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={getStockUrl(stock.ticker, stock.exchange, stock.screenerCode)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={stop}
                className="font-mono font-bold text-base text-primary inline-flex items-center gap-1 active:opacity-70 transition-opacity"
              >
                {stock.ticker}
                <ExternalLink className="h-3.5 w-3.5 opacity-50" />
              </a>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {stock.exchange}
              </Badge>
              {trigger && (
                <Bell className="h-3.5 w-3.5 text-primary animate-pulse" />
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate mt-0.5">{stock.name}</p>
          </div>

          <div className="text-right shrink-0 flex items-start gap-1.5">
            <div>
              {isPriceAvailable ? (
                <>
                  <p className="font-mono font-bold text-base">
                    ₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                  <motion.span
                    key={stock.change}
                    initial={{ scale: 1.05 }}
                    animate={{ scale: 1 }}
                    className={`inline-flex items-center gap-0.5 text-sm font-mono font-semibold px-1.5 py-0.5 rounded-md mt-0.5 ${changeBg} ${changeColor}`}
                  >
                    {isPositive ? "+" : ""}{stock.change.toFixed(2)}
                    <span className="text-[11px] opacity-90">
                      ({isPositive ? "+" : ""}{stock.changePercent.toFixed(2)}%)
                    </span>
                  </motion.span>
                </>
              ) : (
                <>
                  <Skeleton className="h-4 w-16 ml-auto" />
                  <Skeleton className="h-4 w-20 ml-auto mt-1" />
                </>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/60 mt-1 shrink-0" />
          </div>
        </div>

        {isPriceAvailable && (
          <>
            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-2.5 text-xs text-muted-foreground font-mono">
              <span>H: ₹{stock.high.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              <span>L: ₹{stock.low.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              {stock.volume > 0 && <span>Vol: {formatVolume(stock.volume)}</span>}
            </div>
            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1 text-xs text-muted-foreground font-mono">
              <span>
                O: <span className="text-foreground/80">₹{stock.open.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </span>
              <span>
                PC: <span className="text-foreground/80">₹{stock.previousClose.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </span>
            </div>
            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1 text-xs text-muted-foreground font-mono">
              <span>
                P/E:{" "}
                <span className="text-foreground/80 font-semibold">
                  {stock.pe && stock.pe > 0 ? stock.pe.toFixed(2) : "—"}
                </span>
              </span>
              <span>
                MCap:{" "}
                <span className="text-foreground/80 font-semibold">
                  {formatMarketCap(stock.marketCap)}
                </span>
              </span>
            </div>
          </>
        )}
      </motion.div>

      <StockDetailSheet stock={stock} open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
};

export default MobileStockCard;
