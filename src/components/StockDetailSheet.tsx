import { useState, useEffect, useMemo } from "react";
import { Stock, getStockUrl } from "@/lib/stockData";
import { useStocks } from "@/contexts/StockContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  BellOff,
  ExternalLink,
  Trash2,
  Tag,
  Plus,
  Crown,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowLeft,
} from "lucide-react";
import PremiumDialog from "@/components/PremiumDialog";
import PriceChart from "@/components/PriceChart";

interface StockDetailSheetProps {
  stock: Stock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_TAGS = [
  "Earnings",
  "Dividend",
  "Split",
  "Bonus",
  "IPO",
  "Rights",
  "AGM",
  "Buyback",
  "Watch",
  "Target Hit",
];

const StockDetailSheet = ({ stock, open, onOpenChange }: StockDetailSheetProps) => {
  const {
    notes,
    events,
    updateNote,
    updateEvent,
    removeStock,
    priceTriggers,
    setPriceTrigger,
  } = useStocks();
  const { isGuest } = useAuth();
  const { subscription } = useSubscription();
  const isPremium =
    !isGuest &&
    (subscription?.plan === "premium_monthly" ||
      subscription?.plan === "yearly" ||
      subscription?.plan === "annual" ||
      subscription?.plan === "lifetime") &&
    subscription?.status === "active";

  const [noteValue, setNoteValue] = useState("");
  const [triggerValue, setTriggerValue] = useState("");
  const [customTag, setCustomTag] = useState("");
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [premiumFeature, setPremiumFeature] = useState("");

  const note = stock ? notes.find((n) => n.ticker === stock.ticker)?.note || "" : "";
  const stockEvents = stock ? events.find((e) => e.ticker === stock.ticker)?.tags || [] : [];
  const trigger = stock ? priceTriggers[stock.ticker] : undefined;

  // Sync local state when the sheet opens for a different stock
  useEffect(() => {
    if (!stock) return;
    setNoteValue(note);
    setTriggerValue(trigger ? String(trigger.price) : "");
  }, [stock?.ticker, open]);

  const requirePremium = (feature: string) => {
    setPremiumFeature(feature);
    setPremiumOpen(true);
  };

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

  const handleSaveNote = () => {
    if (!stock) return;
    if (!isPremium) return requirePremium("Notes");
    updateNote(stock.ticker, noteValue);
  };

  const handleSaveTrigger = () => {
    if (!stock) return;
    if (!isPremium) return requirePremium("Price Triggers");
    const val = triggerValue.trim();
    setPriceTrigger(stock.ticker, val === "" ? null : parseFloat(val));
  };

  const addTag = (tag: string) => {
    if (!stock) return;
    if (!isPremium) return requirePremium("Event Tags");
    const trimmed = tag.trim();
    if (!trimmed || stockEvents.includes(trimmed)) return;
    updateEvent(stock.ticker, [...stockEvents, trimmed]);
    setCustomTag("");
  };

  const removeTag = (tag: string) => {
    if (!stock) return;
    updateEvent(stock.ticker, stockEvents.filter((t) => t !== tag));
  };

  const handleRemove = () => {
    if (!stock) return;
    removeStock(stock.ticker);
    onOpenChange(false);
  };

  const trendIcon = useMemo(() => {
    if (!stock) return null;
    if (stock.change > 0) return <TrendingUp className="h-4 w-4 text-gain" />;
    if (stock.change < 0) return <TrendingDown className="h-4 w-4 text-loss" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  }, [stock?.change]);

  if (!stock) return null;

  const isPositive = stock.change > 0;
  const isNegative = stock.change < 0;
  const changeColor = isPositive
    ? "text-gain"
    : isNegative
    ? "text-loss"
    : "text-muted-foreground";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 overflow-y-auto"
        >
          <SheetHeader className="px-5 pt-4 pb-3 sticky top-0 bg-background/95 backdrop-blur z-10 border-b border-border">
            <button
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors -ml-1 mb-2 w-fit group"
              aria-label="Back to watchlist"
            >
              <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
              Back to watchlist
            </button>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <SheetTitle className="font-mono text-lg flex items-center gap-2 flex-wrap">
                  {stock.ticker}
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                    {stock.isIndex ? "INDEX" : stock.exchange}
                  </Badge>
                  {trigger && <Bell className="h-3.5 w-3.5 text-primary" />}
                </SheetTitle>
                <SheetDescription className="text-xs mt-0.5 truncate">
                  {stock.name}
                </SheetDescription>
              </div>
              <a
                href={getStockUrl(stock.ticker, stock.exchange, stock.screenerCode)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary inline-flex items-center gap-1 hover:underline shrink-0 mt-1"
                aria-label="Open on Screener.in"
              >
                Screener
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </SheetHeader>

          <div className="px-5 py-4 space-y-5">
            {/* Price summary */}
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="font-mono font-bold text-3xl leading-none">
                  ₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
                <div className={`mt-2 inline-flex items-center gap-1.5 font-mono text-sm font-semibold ${changeColor}`}>
                  {trendIcon}
                  {isPositive ? "+" : ""}
                  {stock.change.toFixed(2)}
                  <span className="opacity-80">
                    ({isPositive ? "+" : ""}
                    {stock.changePercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive price chart */}
            <PriceChart
              ticker={stock.ticker}
              exchange={stock.exchange}
              livePrice={stock.price}
              previousClose={stock.previousClose}
              positive={!isNegative}
            />

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric label="Open" value={`₹${stock.open.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} />
              <Metric label="Prev Close" value={`₹${stock.previousClose.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} />
              <Metric label="Day High" value={`₹${stock.high.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} />
              <Metric label="Day Low" value={`₹${stock.low.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} />
              <Metric label="Volume" value={stock.volume > 0 ? formatVolume(stock.volume) : "—"} />
              <Metric label="Market Cap" value={formatMarketCap(stock.marketCap)} />
              <Metric
                label="P/E Ratio"
                value={stock.pe && stock.pe > 0 ? stock.pe.toFixed(2) : "—"}
              />
              <Metric
                label="Day Range %"
                value={
                  stock.previousClose > 0
                    ? (((stock.high - stock.low) / stock.previousClose) * 100).toFixed(2) + "%"
                    : "—"
                }
              />
            </div>

            <Separator />

            {/* Price trigger */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Bell className="h-3.5 w-3.5 text-primary" />
                  Price Trigger
                  {!isPremium && <Crown className="h-3 w-3 text-amber-500" />}
                </h3>
                {trigger && (
                  <button
                    onClick={() => {
                      setTriggerValue("");
                      setPriceTrigger(stock.ticker, null);
                    }}
                    className="text-[11px] text-muted-foreground hover:text-loss inline-flex items-center gap-1"
                  >
                    <BellOff className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder={`e.g. ${(stock.price * 1.05).toFixed(2)}`}
                  value={triggerValue}
                  onChange={(e) => setTriggerValue(e.target.value)}
                  className="h-9 text-sm font-mono"
                  disabled={!isPremium}
                />
                <Button
                  size="sm"
                  onClick={handleSaveTrigger}
                  className="h-9 shrink-0"
                >
                  Save
                </Button>
              </div>
              {!isPremium ? (
                <p className="text-[11px] text-muted-foreground">
                  Upgrade to Premium to receive alerts when prices cross your trigger.
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  We'll alert you the next time {stock.ticker} crosses this level.
                </p>
              )}
            </section>

            <Separator />

            {/* Note */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                Note
                {!isPremium && <Crown className="h-3 w-3 text-amber-500" />}
              </h3>
              <Textarea
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                placeholder="Add a quick thesis, target, or reminder…"
                className="min-h-[80px] text-sm resize-none"
                disabled={!isPremium}
              />
              <div className="flex justify-end">
                <Button size="sm" variant="secondary" onClick={handleSaveNote} className="h-8">
                  Save note
                </Button>
              </div>
            </section>

            <Separator />

            {/* Event tags */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                Event Tags
                {!isPremium && <Crown className="h-3 w-3 text-amber-500" />}
              </h3>
              {stockEvents.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {stockEvents.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-[11px] cursor-pointer hover:bg-destructive/20 hover:text-destructive transition-colors"
                      onClick={() => removeTag(tag)}
                    >
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TAGS.filter((t) => !stockEvents.includes(t)).map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-[11px] cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => addTag(tag)}
                  >
                    + {tag}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addTag(customTag);
                  }}
                  placeholder="Custom tag…"
                  className="h-8 text-xs"
                  disabled={!isPremium}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => addTag(customTag)}
                  disabled={!isPremium}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </section>

            <Separator />

            {/* Danger */}
            <Button
              variant="ghost"
              className="w-full justify-center text-loss hover:text-loss hover:bg-loss/10"
              onClick={handleRemove}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove from watchlist
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <PremiumDialog
        open={premiumOpen}
        onOpenChange={setPremiumOpen}
        featureName={premiumFeature}
      />
    </>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border bg-card/40 px-2.5 py-1.5">
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="font-mono text-sm font-semibold mt-0.5">{value}</p>
  </div>
);

export default StockDetailSheet;
