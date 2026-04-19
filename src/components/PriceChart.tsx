import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { RefreshCw, LineChart, CandlestickChart } from "lucide-react";

export type PriceRange = "1D" | "1W" | "1M" | "1Y" | "ALL";
export type ChartMode = "line" | "candle";

interface PricePoint {
  price: number;
  recorded_at: string;
  ts: number; // pre-parsed epoch ms for fast filtering / sorting
}

interface Candle {
  ts: number;     // bucket start (midnight IST as epoch ms)
  open: number;
  high: number;
  low: number;
  close: number;
}

// Candle mode is only meaningful for ranges that span multiple days
const CANDLE_ELIGIBLE: Record<PriceRange, boolean> = {
  "1D": false,
  "1W": false,
  "1M": true,
  "1Y": true,
  ALL: true,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function dayBucket(ts: number): number {
  // Bucket by UTC day — simple, monotonic, and consistent with recorded_at storage
  return Math.floor(ts / DAY_MS) * DAY_MS;
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
  "1Y": "1Y",
  ALL: "All",
};

const RANGE_MS: Record<PriceRange, number | null> = {
  "1D": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "1Y": 365 * 24 * 60 * 60 * 1000,
  ALL: null,
};

const WIDTH = 600;
const HEIGHT = 160;
const PADDING_X = 4;
const PADDING_Y = 8;

function formatTime(ts: number, range: PriceRange): string {
  const date = new Date(ts);
  if (range === "1D") {
    return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (range === "1Y" || range === "ALL") {
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
  }
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

const PriceChart = ({ ticker, exchange, livePrice, previousClose, positive = true }: PriceChartProps) => {
  const cacheKey = `${ticker}|${exchange}`;
  const cached = HISTORY_CACHE.get(cacheKey);
  const cacheFresh = cached && Date.now() - cached.at < CACHE_TTL_MS;

  const [allPoints, setAllPoints] = useState<PricePoint[]>(cacheFresh ? cached!.points : []);
  const [loading, setLoading] = useState(!cacheFresh);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<PriceRange>("1D");
  const [mode, setMode] = useState<ChartMode>("line");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverCandleIdx, setHoverCandleIdx] = useState<number | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);

  // Force back to line mode if user switches to a range that doesn't support candles
  useEffect(() => {
    if (mode === "candle" && !CANDLE_ELIGIBLE[range]) {
      setMode("line");
    }
  }, [range, mode]);

  // Fetch history once per ticker, then filter by range client-side.
  useEffect(() => {
    let cancelled = false;
    const fresh = HISTORY_CACHE.get(cacheKey);
    if (fresh && Date.now() - fresh.at < CACHE_TTL_MS && refreshNonce === 0) {
      setAllPoints(fresh.points);
      setLoading(false);
      return;
    }

    if (refreshNonce > 0) setRefreshing(true);
    else setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("stock_price_history")
        .select("price, recorded_at")
        .eq("ticker", ticker)
        .eq("exchange", exchange)
        .order("recorded_at", { ascending: true })
        .limit(5000);
      if (cancelled) return;
      if (error) {
        console.error("Price history fetch failed:", error);
        setAllPoints([]);
      } else {
        // Parse, validate, sort by ts, and de-duplicate identical consecutive ticks
        const parsed: PricePoint[] = (data ?? [])
          .map((d: any) => {
            const ts = new Date(d.recorded_at).getTime();
            return { price: Number(d.price), recorded_at: d.recorded_at, ts };
          })
          .filter((p) => Number.isFinite(p.price) && Number.isFinite(p.ts));
        parsed.sort((a, b) => a.ts - b.ts);
        const clean: PricePoint[] = [];
        for (const p of parsed) {
          const last = clean[clean.length - 1];
          // collapse exact-duplicate timestamps; keep the latest price
          if (last && last.ts === p.ts) {
            clean[clean.length - 1] = p;
          } else {
            clean.push(p);
          }
        }
        HISTORY_CACHE.set(cacheKey, { points: clean, at: Date.now() });
        setAllPoints(clean);
      }
      setLoading(false);
      setRefreshing(false);
    })();
    return () => { cancelled = true; };
  }, [ticker, exchange, cacheKey, refreshNonce]);

  // Append live ticks to the in-memory series so the chart updates in real time.
  useEffect(() => {
    if (!livePrice) return;
    setAllPoints((prev) => {
      const last = prev[prev.length - 1];
      if (last && Math.abs(last.price - livePrice) < 0.0001) return prev;
      const now = Date.now();
      const next = [...prev, { price: livePrice, recorded_at: new Date(now).toISOString(), ts: now }];
      // Update cache too, but mark slightly stale so a refetch still happens
      HISTORY_CACHE.set(cacheKey, { points: next, at: Date.now() - CACHE_TTL_MS / 2 });
      return next;
    });
  }, [livePrice, cacheKey]);

  // Filter to selected range using pre-parsed timestamps
  const points = useMemo(() => {
    if (allPoints.length === 0) return [];
    const cutoffMs = RANGE_MS[range];
    if (cutoffMs == null) return allPoints;
    const cutoff = Date.now() - cutoffMs;
    // Binary search for first in-range index since data is sorted by ts
    let lo = 0, hi = allPoints.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (allPoints[mid].ts < cutoff) lo = mid + 1;
      else hi = mid;
    }
    const filtered = allPoints.slice(lo);
    // Always include the previous in-range anchor + live tick so a single-tick window still draws
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

  // Aggregate raw ticks (NOT downsampled) into daily OHLC candles for candle mode.
  // Uses the unfiltered range `points` so each candle reflects every tick that day.
  const candles = useMemo<Candle[]>(() => {
    if (mode !== "candle" || !CANDLE_ELIGIBLE[range] || points.length === 0) return [];
    const buckets = new Map<number, Candle>();
    for (const p of points) {
      const day = dayBucket(p.ts);
      const existing = buckets.get(day);
      if (!existing) {
        buckets.set(day, { ts: day, open: p.price, high: p.price, low: p.price, close: p.price });
      } else {
        if (p.price > existing.high) existing.high = p.price;
        if (p.price < existing.low) existing.low = p.price;
        existing.close = p.price; // points are sorted, so last write is the close
      }
    }
    return Array.from(buckets.values()).sort((a, b) => a.ts - b.ts);
  }, [points, mode, range]);

  // Scaling for candle mode (separate min/max so wicks fit cleanly)
  const candleScale = useMemo(() => {
    if (candles.length === 0) {
      return { min: 0, max: 0, firstTs: 0, lastTs: 0, candleWidth: 0 };
    }
    let lo = Infinity, hi = -Infinity;
    for (const c of candles) {
      if (c.low < lo) lo = c.low;
      if (c.high > hi) hi = c.high;
    }
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.08;
    lo -= pad; hi += pad;
    const firstTs = candles[0].ts;
    const lastTs = candles[candles.length - 1].ts;
    const usableW = WIDTH - PADDING_X * 2;
    // Reserve ~70% of the per-bucket slot for the candle body
    const slot = candles.length > 1 ? usableW / candles.length : usableW;
    const candleWidth = Math.max(2, Math.min(14, slot * 0.65));
    return { min: lo, max: hi, firstTs, lastTs, candleWidth };
  }, [candles]);

  const candleX = useCallback((ts: number) => {
    if (candles.length <= 1) return WIDTH / 2;
    const usableW = WIDTH - PADDING_X * 2;
    // Center each candle in its time slot
    const slot = usableW / candles.length;
    const idx = candles.findIndex((c) => c.ts === ts);
    return PADDING_X + slot * idx + slot / 2;
  }, [candles]);

  const candleY = useCallback((price: number) => {
    const usableH = HEIGHT - PADDING_Y * 2;
    const r = (candleScale.max - candleScale.min) || 1;
    return PADDING_Y + usableH - ((price - candleScale.min) / r) * usableH;
  }, [candleScale]);

  const showCandles = mode === "candle" && CANDLE_ELIGIBLE[range] && candles.length >= 2;

  const { min, max, paths, baselineY } = useMemo(() => {
    if (renderPoints.length < 2) {
      return { min: 0, max: 0, paths: { line: "", area: "" }, baselineY: null as number | null };
    }
    const prices = renderPoints.map((p) => p.price);
    let lo = Math.min(...prices);
    let hi = Math.max(...prices);
    if (range === "1D" && previousClose && previousClose > 0) {
      // Only anchor previous-close baseline on intraday view
      lo = Math.min(lo, previousClose);
      hi = Math.max(hi, previousClose);
    }
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.08;
    lo -= pad; hi += pad;
    const range2 = hi - lo;
    const usableW = WIDTH - PADDING_X * 2;
    const usableH = HEIGHT - PADDING_Y * 2;

    // Time-proportional X positions so spacing reflects actual time gaps
    const firstTs = renderPoints[0].ts;
    const lastTs = renderPoints[renderPoints.length - 1].ts;
    const timeSpan = Math.max(1, lastTs - firstTs);

    let line = "";
    renderPoints.forEach((p, i) => {
      const x = PADDING_X + ((p.ts - firstTs) / timeSpan) * usableW;
      const y = PADDING_Y + usableH - ((p.price - lo) / range2) * usableH;
      line += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)} `;
    });
    const area = `${line} L${WIDTH - PADDING_X},${HEIGHT - PADDING_Y} L${PADDING_X},${HEIGHT - PADDING_Y} Z`;
    const bY = (range === "1D" && previousClose)
      ? PADDING_Y + usableH - ((previousClose - lo) / range2) * usableH
      : null;
    return { min: lo, max: hi, paths: { line: line.trim(), area }, baselineY: bY };
  }, [renderPoints, previousClose, range]);

  // Pointer interaction → crosshair (uses time-proportional mapping)
  const handleMove = useCallback((clientX: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));

    if (showCandles) {
      // Pick the nearest candle bucket
      const idx = Math.min(candles.length - 1, Math.max(0, Math.floor(ratio * candles.length)));
      setHoverCandleIdx(idx);
      setHoverIdx(null);
      return;
    }

    if (renderPoints.length < 2) return;
    const firstTs = renderPoints[0].ts;
    const lastTs = renderPoints[renderPoints.length - 1].ts;
    const targetTs = firstTs + ratio * (lastTs - firstTs);
    let lo = 0, hi = renderPoints.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (renderPoints[mid].ts < targetTs) lo = mid + 1;
      else hi = mid;
    }
    let idx = lo;
    if (lo > 0 && Math.abs(renderPoints[lo - 1].ts - targetTs) < Math.abs(renderPoints[lo].ts - targetTs)) {
      idx = lo - 1;
    }
    setHoverIdx(idx);
    setHoverCandleIdx(null);
  }, [renderPoints, showCandles, candles.length]);

  const stroke = positive ? "hsl(var(--gain))" : "hsl(var(--loss))";
  const gradientId = `pchart-grad-${ticker}-${exchange}-${positive ? "up" : "dn"}`;

  // Hover details (use time-proportional X)
  const hoverPoint = hoverIdx != null ? renderPoints[hoverIdx] : null;
  const hoverX = useMemo(() => {
    if (!hoverPoint || renderPoints.length < 2) return 0;
    const usableW = WIDTH - PADDING_X * 2;
    const firstTs = renderPoints[0].ts;
    const lastTs = renderPoints[renderPoints.length - 1].ts;
    return PADDING_X + ((hoverPoint.ts - firstTs) / Math.max(1, lastTs - firstTs)) * usableW;
  }, [hoverPoint, renderPoints]);
  const hoverY = useMemo(() => {
    if (!hoverPoint) return 0;
    const r = max - min || 1;
    const usableH = HEIGHT - PADDING_Y * 2;
    return PADDING_Y + usableH - ((hoverPoint.price - min) / r) * usableH;
  }, [hoverPoint, min, max]);

  const lastPoint = renderPoints[renderPoints.length - 1];
  const firstPoint = renderPoints[0];
  const change = lastPoint && firstPoint ? lastPoint.price - firstPoint.price : 0;
  const changePct = firstPoint && firstPoint.price > 0 ? (change / firstPoint.price) * 100 : 0;
  const rangePositive = change >= 0;

  // Last point pixel position for the live pulse
  const lastXY = useMemo(() => {
    if (!lastPoint || renderPoints.length < 2) return null;
    const usableW = WIDTH - PADDING_X * 2;
    const usableH = HEIGHT - PADDING_Y * 2;
    const firstTs = renderPoints[0].ts;
    const lastTs = renderPoints[renderPoints.length - 1].ts;
    const r = max - min || 1;
    const x = PADDING_X + ((lastPoint.ts - firstTs) / Math.max(1, lastTs - firstTs)) * usableW;
    const y = PADDING_Y + usableH - ((lastPoint.price - min) / r) * usableH;
    return { x, y };
  }, [lastPoint, renderPoints, min, max]);

  const handleRefresh = () => {
    HISTORY_CACHE.delete(cacheKey);
    setHoverIdx(null);
    setHoverCandleIdx(null);
    setRefreshNonce((n) => n + 1);
  };

  const hoverCandle = hoverCandleIdx != null ? candles[hoverCandleIdx] : null;
  const candleEligible = CANDLE_ELIGIBLE[range];

  return (
    <div className="rounded-xl border border-border bg-muted/10 p-3 select-none">
      {/* Header: range stats + refresh + tabs */}
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
        <div className="flex items-center gap-1 flex-wrap justify-end">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className={cn(
              "h-7 w-7 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground",
              "hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
            )}
            aria-label="Refresh chart data"
            title="Refresh chart data"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>

          {/* Line / Candle mode toggle — only meaningful for multi-day ranges */}
          <div className="flex items-center gap-0.5 bg-background/80 border border-border rounded-md p-0.5">
            <button
              onClick={() => { setMode("line"); setHoverIdx(null); setHoverCandleIdx(null); }}
              className={cn(
                "h-6 w-6 inline-flex items-center justify-center rounded transition-colors",
                mode === "line"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
              aria-pressed={mode === "line"}
              aria-label="Line chart"
              title="Line chart"
            >
              <LineChart className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => { if (candleEligible) { setMode("candle"); setHoverIdx(null); setHoverCandleIdx(null); } }}
              disabled={!candleEligible}
              className={cn(
                "h-6 w-6 inline-flex items-center justify-center rounded transition-colors",
                mode === "candle" && candleEligible
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                !candleEligible && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground"
              )}
              aria-pressed={mode === "candle"}
              aria-label="Candlestick chart"
              title={candleEligible ? "Daily candlesticks" : "Candlesticks available on 1M / 1Y / All"}
            >
              <CandlestickChart className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-0.5 bg-background/80 border border-border rounded-md p-0.5">
            {(Object.keys(RANGE_LABELS) as PriceRange[]).map((r) => (
              <button
                key={r}
                onClick={() => { setRange(r); setHoverIdx(null); setHoverCandleIdx(null); }}
                className={cn(
                  "px-1.5 py-1 text-[11px] font-semibold rounded transition-colors",
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
      </div>

      {/* Chart */}
      <div className="relative">
        {loading && allPoints.length === 0 ? (
          <Skeleton className="w-full h-40 rounded-md" />
        ) : renderPoints.length < 2 ? (
          <div className="h-40 flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
            <span>No {RANGE_LABELS[range]} data yet.</span>
            <span className="text-[10px]">Try a wider range or refresh — new ticks are recorded as the dashboard polls.</span>
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

              {/* Previous close baseline (intraday only) */}
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
              {!hoverPoint && lastXY && (
                <g pointerEvents="none">
                  <circle cx={lastXY.x} cy={lastXY.y} r="6" fill={stroke} fillOpacity="0.25">
                    <animate attributeName="r" values="3;9;3" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="fill-opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={lastXY.x} cy={lastXY.y} r="3" fill={stroke} stroke="hsl(var(--background))" strokeWidth="1.5" />
                </g>
              )}
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
                  {formatTime(hoverPoint.ts, range)}
                </p>
              </div>
            )}

            {/* Axis labels */}
            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground font-mono px-1">
              <span>{firstPoint && formatTime(firstPoint.ts, range)}</span>
              <span>{lastPoint && formatTime(lastPoint.ts, range)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PriceChart;
