import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type PriceRange = "1D" | "1W" | "1M" | "ALL";

interface PricePoint {
  price: number;
  recorded_at: string;
}

interface PriceChartProps {
  ticker: string;
  exchange: string;
  livePrice?: number;
  previousClose?: number;
  positive?: boolean;
}

// Module-level cache so re-opening the sheet for the same stock is instant.
// Keyed by `${ticker}|${exchange}`, valid for 60 seconds.
const HISTORY_CACHE = new Map<string, { points: PricePoint[]; at: number }>();
const CACHE_TTL_MS = 60_000;

const RANGE_LABELS: Record<PriceRange, string> = {
  "1D": "1D",
  "1W": "1W",
  "1M": "1M",
  ALL: "All",
};

const RANGE_MS: Record<PriceRange, number | null> = {
  "1D": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  ALL: null,
};

const WIDTH = 600;
const HEIGHT = 160;
const PADDING_X = 4;
const PADDING_Y = 8;

function formatTime(date: Date, range: PriceRange): string {
  if (range === "1D") {
    return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

const PriceChart = ({ ticker, exchange, livePrice, previousClose, positive = true }: PriceChartProps) => {
  const cacheKey = `${ticker}|${exchange}`;
  const cached = HISTORY_CACHE.get(cacheKey);
  const cacheFresh = cached && Date.now() - cached.at < CACHE_TTL_MS;

  const [allPoints, setAllPoints] = useState<PricePoint[]>(cacheFresh ? cached!.points : []);
  const [loading, setLoading] = useState(!cacheFresh);
  const [range, setRange] = useState<PriceRange>("1D");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Fetch history once per ticker, then filter by range client-side.
  useEffect(() => {
    let cancelled = false;
    const fresh = HISTORY_CACHE.get(cacheKey);
    if (fresh && Date.now() - fresh.at < CACHE_TTL_MS) {
      setAllPoints(fresh.points);
      setLoading(false);
      return;
    }

    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("stock_price_history")
        .select("price, recorded_at")
        .eq("ticker", ticker)
        .eq("exchange", exchange)
        .order("recorded_at", { ascending: true })
        .limit(2000);
      if (cancelled) return;
      if (error) {
        console.error("Price history fetch failed:", error);
        setAllPoints([]);
      } else {
        const clean: PricePoint[] = (data ?? [])
          .map((d: any) => ({ price: Number(d.price), recorded_at: d.recorded_at }))
          .filter((p) => Number.isFinite(p.price));
        HISTORY_CACHE.set(cacheKey, { points: clean, at: Date.now() });
        setAllPoints(clean);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [ticker, exchange, cacheKey]);

  // Append live ticks to the in-memory series so the chart updates in real time.
  useEffect(() => {
    if (!livePrice) return;
    setAllPoints((prev) => {
      const last = prev[prev.length - 1];
      if (last && Math.abs(last.price - livePrice) < 0.0001) return prev;
      const next = [...prev, { price: livePrice, recorded_at: new Date().toISOString() }];
      // Update cache too, but mark slightly stale so a refetch still happens
      HISTORY_CACHE.set(cacheKey, { points: next, at: Date.now() - CACHE_TTL_MS / 2 });
      return next;
    });
  }, [livePrice, cacheKey]);

  // Filter to selected range
  const points = useMemo(() => {
    if (allPoints.length === 0) return [];
    const cutoffMs = RANGE_MS[range];
    if (cutoffMs == null) return allPoints;
    const cutoff = Date.now() - cutoffMs;
    const filtered = allPoints.filter((p) => new Date(p.recorded_at).getTime() >= cutoff);
    // Always include the previous in-range anchor + live tick so a single-tick day still draws
    if (filtered.length < 2 && allPoints.length >= 2) {
      return allPoints.slice(-2);
    }
    return filtered;
  }, [allPoints, range]);

  // Downsample very dense series for smooth rendering (max ~250 points)
  const renderPoints = useMemo(() => {
    if (points.length <= 250) return points;
    const stride = Math.ceil(points.length / 250);
    const out: PricePoint[] = [];
    for (let i = 0; i < points.length; i += stride) out.push(points[i]);
    if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
    return out;
  }, [points]);

  const { min, max, paths, baselineY } = useMemo(() => {
    if (renderPoints.length < 2) {
      return { min: 0, max: 0, paths: { line: "", area: "" }, baselineY: null as number | null };
    }
    const prices = renderPoints.map((p) => p.price);
    let lo = Math.min(...prices);
    let hi = Math.max(...prices);
    if (previousClose && previousClose > 0) {
      lo = Math.min(lo, previousClose);
      hi = Math.max(hi, previousClose);
    }
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.08;
    lo -= pad; hi += pad;
    const range = hi - lo;
    const usableW = WIDTH - PADDING_X * 2;
    const usableH = HEIGHT - PADDING_Y * 2;
    const stepX = usableW / (renderPoints.length - 1);

    let line = "";
    renderPoints.forEach((p, i) => {
      const x = PADDING_X + i * stepX;
      const y = PADDING_Y + usableH - ((p.price - lo) / range) * usableH;
      line += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)} `;
    });
    const area = `${line} L${WIDTH - PADDING_X},${HEIGHT - PADDING_Y} L${PADDING_X},${HEIGHT - PADDING_Y} Z`;
    const bY = previousClose
      ? PADDING_Y + usableH - ((previousClose - lo) / range) * usableH
      : null;
    return { min: lo, max: hi, paths: { line: line.trim(), area }, baselineY: bY };
  }, [renderPoints, previousClose]);

  // Pointer interaction → crosshair
  const handleMove = useCallback((clientX: number) => {
    if (!svgRef.current || renderPoints.length < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const idx = Math.round(ratio * (renderPoints.length - 1));
    setHoverIdx(Math.max(0, Math.min(renderPoints.length - 1, idx)));
  }, [renderPoints.length]);

  const stroke = positive ? "hsl(var(--gain))" : "hsl(var(--loss))";
  const gradientId = `pchart-grad-${ticker}-${exchange}-${positive ? "up" : "dn"}`;

  // Hover details
  const hoverPoint = hoverIdx != null ? renderPoints[hoverIdx] : null;
  const hoverX = useMemo(() => {
    if (hoverIdx == null || renderPoints.length < 2) return 0;
    const usableW = WIDTH - PADDING_X * 2;
    return PADDING_X + (hoverIdx * usableW) / (renderPoints.length - 1);
  }, [hoverIdx, renderPoints.length]);
  const hoverY = useMemo(() => {
    if (!hoverPoint) return 0;
    const range = max - min || 1;
    const usableH = HEIGHT - PADDING_Y * 2;
    return PADDING_Y + usableH - ((hoverPoint.price - min) / range) * usableH;
  }, [hoverPoint, min, max]);

  const lastPoint = renderPoints[renderPoints.length - 1];
  const firstPoint = renderPoints[0];
  const change = lastPoint && firstPoint ? lastPoint.price - firstPoint.price : 0;
  const changePct = firstPoint && firstPoint.price > 0 ? (change / firstPoint.price) * 100 : 0;
  const rangePositive = change >= 0;

  return (
    <div className="rounded-xl border border-border bg-muted/10 p-3 select-none">
      {/* Header: range stats + tabs */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {RANGE_LABELS[range]} change
          </p>
          {loading && allPoints.length === 0 ? (
            <Skeleton className="h-4 w-24 mt-0.5" />
          ) : renderPoints.length >= 2 ? (
            <p className={cn("text-sm font-mono font-semibold", rangePositive ? "text-gain" : "text-loss")}>
              {rangePositive ? "+" : ""}{change.toFixed(2)}{" "}
              <span className="text-xs opacity-80">({rangePositive ? "+" : ""}{changePct.toFixed(2)}%)</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Building history…</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 bg-background/80 border border-border rounded-md p-0.5">
          {(Object.keys(RANGE_LABELS) as PriceRange[]).map((r) => (
            <button
              key={r}
              onClick={() => { setRange(r); setHoverIdx(null); }}
              className={cn(
                "px-2 py-1 text-[11px] font-semibold rounded transition-colors",
                range === r
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
              aria-pressed={range === r}
              aria-label={`Show ${RANGE_LABELS[r]} chart`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        {loading && allPoints.length === 0 ? (
          <Skeleton className="w-full h-40 rounded-md" />
        ) : renderPoints.length < 2 ? (
          <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
            Not enough data yet — refresh the dashboard to record more ticks.
          </div>
        ) : (
          <>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              preserveAspectRatio="none"
              className="w-full h-40 touch-none cursor-crosshair"
              role="img"
              aria-label={`${ticker} ${RANGE_LABELS[range]} price chart`}
              onMouseMove={(e) => handleMove(e.clientX)}
              onMouseLeave={() => setHoverIdx(null)}
              onTouchStart={(e) => handleMove(e.touches[0].clientX)}
              onTouchMove={(e) => { e.preventDefault(); handleMove(e.touches[0].clientX); }}
              onTouchEnd={() => setHoverIdx(null)}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Previous close baseline */}
              {baselineY != null && (
                <line
                  x1={PADDING_X}
                  x2={WIDTH - PADDING_X}
                  y1={baselineY}
                  y2={baselineY}
                  stroke="hsl(var(--muted-foreground))"
                  strokeOpacity="0.35"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              )}

              {/* Area */}
              <path d={paths.area} fill={`url(#${gradientId})`} />
              {/* Line */}
              <path
                d={paths.line}
                fill="none"
                stroke={stroke}
                strokeWidth="1.75"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />

              {/* Crosshair */}
              {hoverPoint && (
                <g pointerEvents="none">
                  <line
                    x1={hoverX}
                    x2={hoverX}
                    y1={PADDING_Y}
                    y2={HEIGHT - PADDING_Y}
                    stroke="hsl(var(--foreground))"
                    strokeOpacity="0.25"
                    strokeWidth="1"
                  />
                  <circle cx={hoverX} cy={hoverY} r="4" fill={stroke} stroke="hsl(var(--background))" strokeWidth="2" />
                </g>
              )}

              {/* Latest point pulse */}
              {!hoverPoint && lastPoint && (() => {
                const usableW = WIDTH - PADDING_X * 2;
                const stepX = usableW / (renderPoints.length - 1);
                const lx = PADDING_X + (renderPoints.length - 1) * stepX;
                const range = max - min || 1;
                const usableH = HEIGHT - PADDING_Y * 2;
                const ly = PADDING_Y + usableH - ((lastPoint.price - min) / range) * usableH;
                return (
                  <g pointerEvents="none">
                    <circle cx={lx} cy={ly} r="6" fill={stroke} fillOpacity="0.25">
                      <animate attributeName="r" values="3;9;3" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="fill-opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={lx} cy={ly} r="3" fill={stroke} stroke="hsl(var(--background))" strokeWidth="1.5" />
                  </g>
                );
              })()}
            </svg>

            {/* Hover tooltip */}
            {hoverPoint && (
              <div
                className="pointer-events-none absolute -top-1 -translate-y-full bg-popover text-popover-foreground border border-border rounded-md px-2 py-1 text-xs shadow-lg whitespace-nowrap"
                style={{
                  left: `calc(${(hoverX / WIDTH) * 100}% )`,
                  transform: `translate(-50%, -100%)`,
                }}
              >
                <p className="font-mono font-semibold">
                  ₹{hoverPoint.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatTime(new Date(hoverPoint.recorded_at), range)}
                </p>
              </div>
            )}

            {/* Axis labels */}
            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground font-mono px-1">
              <span>{firstPoint && formatTime(new Date(firstPoint.recorded_at), range)}</span>
              <span>{lastPoint && formatTime(new Date(lastPoint.recorded_at), range)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PriceChart;
