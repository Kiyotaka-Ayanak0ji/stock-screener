import { Stock, getStockUrl } from "@/lib/stockData";
import { useStocks } from "@/contexts/StockContext";
import { ExternalLink, Trash2, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

interface MobileStockCardProps {
  stock: Stock;
  index: number;
  priceLoading?: boolean;
}

const MobileStockCard = ({ stock, index, priceLoading }: MobileStockCardProps) => {
  const { removeStock, priceTriggers } = useStocks();

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ delay: index * 0.02, duration: 0.25 }}
      className="border-b border-border px-4 py-3.5 active:bg-muted/50 transition-all duration-150 hover:bg-muted/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={getStockUrl(stock.ticker, stock.exchange, stock.screenerCode)}
              target="_blank"
              rel="noopener noreferrer"
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

        <div className="text-right shrink-0">
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
      </div>

      {isPriceAvailable && (
        <>
          <div className="flex items-center justify-between mt-2.5 text-xs text-muted-foreground font-mono">
            <div className="flex items-center gap-3 flex-wrap">
              <span>H: ₹{stock.high.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              <span>L: ₹{stock.low.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              {stock.volume > 0 && <span>Vol: {formatVolume(stock.volume)}</span>}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-muted-foreground hover:text-loss active:scale-90 transition-all shrink-0 -mr-2"
              onClick={() => removeStock(stock.ticker)}
              aria-label={`Remove ${stock.ticker}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-3 flex-wrap mt-1.5 text-xs text-muted-foreground font-mono">
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
  );
};

export default MobileStockCard;
