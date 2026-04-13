import { Stock, getStockUrl } from "@/lib/stockData";
import { useStocks } from "@/contexts/StockContext";
import { ExternalLink, Trash2, Bell, BellOff, Crown } from "lucide-react";
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ delay: index * 0.02, duration: 0.25 }}
      className="border-b border-border px-3 py-3 active:bg-muted/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <a
              href={getStockUrl(stock.ticker, stock.exchange, stock.screenerCode)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono font-bold text-sm text-primary inline-flex items-center gap-1"
            >
              {stock.ticker}
              <ExternalLink className="h-3 w-3 opacity-40" />
            </a>
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
              {stock.exchange}
            </Badge>
            {trigger && (
              <Bell className="h-3 w-3 text-primary" />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{stock.name}</p>
        </div>

        <div className="text-right shrink-0">
          {isPriceAvailable ? (
            <>
              <p className="font-mono font-semibold text-sm">
                ₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              <span className={`inline-flex items-center gap-0.5 text-xs font-mono px-1.5 py-0.5 rounded ${changeBg} ${changeColor}`}>
                {isPositive ? "+" : ""}{stock.change.toFixed(2)}
                <span className="text-[10px]">
                  ({isPositive ? "+" : ""}{stock.changePercent.toFixed(2)}%)
                </span>
              </span>
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
        <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground font-mono">
          <div className="flex items-center gap-3">
            <span>H: ₹{stock.high.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            <span>L: ₹{stock.low.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            {stock.volume > 0 && <span>Vol: {formatVolume(stock.volume)}</span>}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-loss shrink-0"
            onClick={() => removeStock(stock.ticker)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </motion.div>
  );
};

export default MobileStockCard;
