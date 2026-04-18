import { useState, useRef } from "react";
import { Stock, getStockUrl } from "@/lib/stockData";
import { useStocks } from "@/contexts/StockContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { ExternalLink, Bell, ChevronRight, Trash2, Crown, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion, useMotionValue, useTransform, animate, type PanInfo } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import StockDetailSheet from "@/components/StockDetailSheet";
import PremiumDialog from "@/components/PremiumDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface MobileStockCardProps {
  stock: Stock;
  index: number;
  priceLoading?: boolean;
}

const SWIPE_THRESHOLD = 90;
const SWIPE_UP_THRESHOLD = 70;

const MobileStockCard = ({ stock, index, priceLoading }: MobileStockCardProps) => {
  const { priceTriggers, removeStock, addStock, setPriceTrigger, notes, updateNote } = useStocks();
  const { isGuest } = useAuth();
  const { subscription } = useSubscription();
  const isPremium =
    !isGuest &&
    (subscription?.plan === "premium_monthly" ||
      subscription?.plan === "yearly" ||
      subscription?.plan === "annual" ||
      subscription?.plan === "lifetime") &&
    subscription?.status === "active";

  const [detailOpen, setDetailOpen] = useState(false);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [triggerValue, setTriggerValue] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteValue, setNoteValue] = useState("");
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [premiumFeature, setPremiumFeature] = useState("Price Triggers");
  const swipedRef = useRef(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  // Action backgrounds: red (delete) on left swipe, primary (trigger) on right swipe, accent (note) on up swipe
  const leftActionOpacity = useTransform(x, [-SWIPE_THRESHOLD, -20, 0], [1, 0.3, 0]);
  const rightActionOpacity = useTransform(x, [0, 20, SWIPE_THRESHOLD], [0, 0.3, 1]);
  const upActionOpacity = useTransform(y, [-SWIPE_UP_THRESHOLD, -15, 0], [1, 0.3, 0]);

  const isPriceAvailable = !priceLoading || stock.price !== 0;
  const isPositive = stock.change > 0;
  const isNegative = stock.change < 0;
  const changeColor = isPositive ? "text-gain" : isNegative ? "text-loss" : "text-muted-foreground";
  const changeBg = isPositive ? "bg-gain/10" : isNegative ? "bg-loss/10" : "bg-muted";
  const trigger = priceTriggers[stock.ticker];
  const existingNote = notes.find((n) => n.ticker === stock.ticker)?.note ?? "";

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

  const handleOpen = () => {
    if (swipedRef.current) {
      swipedRef.current = false;
      return;
    }
    if (!isPremium) {
      setPremiumFeature("Stock Detail Sheet");
      setPremiumOpen(true);
      return;
    }
    setDetailOpen(true);
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const performDelete = () => {
    // Snapshot what we need to restore
    const snapshot = {
      ticker: stock.ticker,
      name: stock.name,
      exchange: stock.exchange as "NSE" | "BSE",
      yahooSymbol: stock.yahooSymbol,
      isIndex: stock.isIndex,
      screenerCode: stock.screenerCode,
    };
    let undone = false;
    removeStock(snapshot.ticker);
    toast(`${snapshot.ticker} removed from watchlist`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          addStock(snapshot.ticker, snapshot.name, snapshot.exchange, {
            yahooSymbol: snapshot.yahooSymbol,
            isIndex: snapshot.isIndex,
            screenerCode: snapshot.screenerCode,
          });
          toast.success(`${snapshot.ticker} restored`);
        },
      },
    });
    // No further action needed; if undone, addStock re-inserts ticker.
    void undone;
  };

  const openNoteSheet = () => {
    if (!isPremium) {
      setPremiumFeature("Notes");
      setPremiumOpen(true);
      return;
    }
    setNoteValue(existingNote);
    setNoteOpen(true);
  };

  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    const offsetX = info.offset.x;
    const offsetY = info.offset.y;
    const velocityX = info.velocity.x;
    const velocityY = info.velocity.y;

    // Vertical wins only when clearly more vertical than horizontal.
    const verticalDominant = Math.abs(offsetY) > Math.abs(offsetX) * 1.2;
    const upTriggered =
      verticalDominant && (offsetY < -SWIPE_UP_THRESHOLD || velocityY < -500);

    if (upTriggered) {
      swipedRef.current = true;
      animate(y, 0, { type: "spring", stiffness: 400, damping: 30 });
      animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
      openNoteSheet();
      return;
    }

    const horizontalTriggered =
      Math.abs(offsetX) > SWIPE_THRESHOLD || Math.abs(velocityX) > 500;

    if (horizontalTriggered && offsetX < 0) {
      // Swipe left → delete (with Undo)
      swipedRef.current = true;
      animate(y, 0, { type: "spring", stiffness: 400, damping: 30 });
      animate(x, -400, { duration: 0.18 }).then(() => {
        performDelete();
      });
      return;
    }

    if (horizontalTriggered && offsetX > 0) {
      // Swipe right → set trigger
      swipedRef.current = true;
      animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
      animate(y, 0, { type: "spring", stiffness: 400, damping: 30 });
      if (!isPremium) {
        setPremiumFeature("Price Triggers");
        setPremiumOpen(true);
        return;
      }
      setTriggerValue(trigger ? String(trigger.price) : stock.price.toFixed(2));
      setTriggerOpen(true);
      return;
    }

    // Snap back
    animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
    animate(y, 0, { type: "spring", stiffness: 400, damping: 30 });
  };

  const saveNote = () => {
    updateNote(stock.ticker, noteValue.trim());
    if (noteValue.trim()) {
      toast.success(`Note saved for ${stock.ticker}`);
    } else {
      toast.success(`Note cleared for ${stock.ticker}`);
    }
    setNoteOpen(false);
  };

  const saveTrigger = () => {
    const val = triggerValue.trim();
    if (val === "") {
      setPriceTrigger(stock.ticker, null);
      toast.success(`Trigger cleared for ${stock.ticker}`);
    } else {
      const num = parseFloat(val);
      if (!Number.isFinite(num) || num <= 0) {
        toast.error("Enter a valid price");
        return;
      }
      setPriceTrigger(stock.ticker, num);
      toast.success(`Trigger set at ₹${num.toFixed(2)} for ${stock.ticker}`);
    }
    setTriggerOpen(false);
  };

  return (
    <>
      <div className="relative overflow-hidden border-b border-border">
        {/* Swipe-right action background (set trigger) */}
        <motion.div
          style={{ opacity: rightActionOpacity }}
          className="absolute inset-y-0 left-0 flex items-center pl-5 bg-primary/15 text-primary pointer-events-none"
          aria-hidden="true"
        >
          <Bell className="h-5 w-5 mr-2" />
          <span className="text-xs font-semibold uppercase tracking-wide">Set Trigger</span>
        </motion.div>
        {/* Swipe-left action background (delete) */}
        <motion.div
          style={{ opacity: leftActionOpacity }}
          className="absolute inset-y-0 right-0 flex items-center justify-end pr-5 bg-loss/15 text-loss pointer-events-none"
          aria-hidden="true"
        >
          <span className="text-xs font-semibold uppercase tracking-wide mr-2">Remove</span>
          <Trash2 className="h-5 w-5" />
        </motion.div>

        {/* Swipe-up action background (quick note) */}
        <motion.div
          style={{ opacity: upActionOpacity }}
          className="absolute inset-x-0 bottom-0 flex items-center justify-center py-2 bg-accent/30 text-accent-foreground pointer-events-none"
          aria-hidden="true"
        >
          <StickyNote className="h-4 w-4 mr-2 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide">Quick Note</span>
        </motion.div>

        <motion.div
          drag
          dragConstraints={{ left: 0, right: 0, top: -120, bottom: 0 }}
          dragElastic={0.6}
          dragDirectionLock
          onDragEnd={handleDragEnd}
          style={{ x, y }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
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
          aria-label={`Open details for ${stock.ticker}. Swipe right to set price trigger, swipe left to remove, swipe up to add a note.`}
          className="relative bg-background px-4 py-3.5 active:bg-muted/50 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
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
      </div>

      <StockDetailSheet stock={stock} open={detailOpen} onOpenChange={setDetailOpen} />

      <Dialog open={triggerOpen} onOpenChange={setTriggerOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono">Price Trigger · {stock.ticker}</DialogTitle>
            <DialogDescription>
              Current price: ₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}.
              Leave empty to clear an existing trigger.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="number"
            step="any"
            inputMode="decimal"
            autoFocus
            value={triggerValue}
            onChange={(e) => setTriggerValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveTrigger(); }}
            placeholder="Trigger price"
            className="font-mono"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTriggerOpen(false)}>Cancel</Button>
            <Button onClick={saveTrigger}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PremiumDialog open={premiumOpen} onOpenChange={setPremiumOpen} featureName={premiumFeature} />
    </>
  );
};

export default MobileStockCard;
