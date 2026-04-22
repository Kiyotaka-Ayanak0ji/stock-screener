import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getFreshness, type FreshnessState } from "@/lib/stockFreshness";
import { cn } from "@/lib/utils";

interface StockFreshnessBadgeProps {
  lastUpdated: Date | string | number | null | undefined;
  isMarketOpen: boolean;
  /** "dot" = small status dot (used in row); "pill" = labelled chip (used in detail sheet). */
  variant?: "dot" | "pill";
  /** Optional inline ETA chip alongside the dot — useful in the watchlist row/card. */
  showEta?: boolean;
  className?: string;
}

const STATE_STYLES: Record<FreshnessState, { dot: string; ring: string; text: string }> = {
  fresh: {
    dot: "bg-gain",
    ring: "ring-gain/30",
    text: "text-gain",
  },
  stale: {
    dot: "bg-amber-400",
    ring: "ring-amber-400/30",
    text: "text-amber-500",
  },
  "very-stale": {
    dot: "bg-loss",
    ring: "ring-loss/40",
    text: "text-loss",
  },
  unknown: {
    dot: "bg-muted-foreground/40",
    ring: "ring-muted-foreground/20",
    text: "text-muted-foreground",
  },
};

const StockFreshnessBadge = ({
  lastUpdated,
  isMarketOpen,
  variant = "dot",
  showEta = false,
  className,
}: StockFreshnessBadgeProps) => {
  const info = getFreshness(lastUpdated, isMarketOpen);
  const styles = STATE_STYLES[info.state];

  const tooltipContent = (
    <div className="space-y-1 text-[11px] leading-snug">
      <div className="font-medium text-foreground">{info.tooltip}</div>
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-muted-foreground">
        <span className="opacity-70">Last updated</span>
        <span className="font-mono text-foreground/90">{info.exactLabel}</span>
        <span className="opacity-70">Next refresh</span>
        <span className="font-mono text-foreground/90">{info.etaLabel}</span>
      </div>
      <div className="text-muted-foreground/80 italic">{info.etaReason}</div>
    </div>
  );

  if (variant === "pill") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border border-border/60 bg-muted/40",
              styles.text,
              className,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
            {info.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px]">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={`Data freshness: ${info.state}. Last updated ${info.label}, ${info.exactLabel}. Next refresh ${info.etaLabel}.`}
          className={cn(
            "inline-flex items-center gap-1 align-middle",
            className,
          )}
        >
          <span
            className={cn(
              "inline-block h-1.5 w-1.5 rounded-full ring-2 ring-offset-0 shrink-0",
              styles.dot,
              styles.ring,
              (info.state === "stale" || info.state === "very-stale") && "animate-pulse",
            )}
          />
          {showEta && (
            <span
              className={cn(
                "hidden sm:inline text-[9px] font-medium tabular-nums tracking-tight",
                styles.text,
                "opacity-80",
              )}
            >
              {info.etaLabel}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px]">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
};

export default StockFreshnessBadge;
