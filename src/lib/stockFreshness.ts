// Centralized freshness logic for cached stock data.
// Thresholds: 4h during market hours, 24h after close.
// "very-stale" = beyond the threshold (warning); "stale" = approaching it (subtle hint).

export type FreshnessState = "fresh" | "stale" | "very-stale" | "unknown";

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

// Background seeding cycle: full universe (~7,500 tickers) is refreshed
// across a rolling 24h window. After the most recent refresh, the next
// touch should land within roughly this window.
const SEED_CYCLE_MS = 24 * HOUR;
// Live polling cadence while market is open (matches StockContext interval).
const LIVE_POLL_MS = 5 * 1000;

export interface FreshnessInfo {
  state: FreshnessState;
  ageMs: number;
  /** Human-friendly age, e.g. "12 min ago", "5h ago", "2d ago". */
  label: string;
  /** Tooltip explanation tailored to state + market context. */
  tooltip: string;
  /** Absolute "last updated" timestamp formatted for IST display. */
  exactLabel: string;
  /** Estimated time until the next automatic refresh (e.g. "in ~3h" or "in seconds"). */
  etaLabel: string;
  /** Why the ETA is what it is — used in tooltips. */
  etaReason: string;
}

function formatAge(ms: number): string {
  if (ms < 60_000) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) {
    const remMin = min % 60;
    return remMin > 0 && hours < 6 ? `${hours}h ${remMin}m ago` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function formatEta(ms: number): string {
  if (ms <= 0) return "any moment";
  if (ms < 90 * 1000) return "in seconds";
  const min = Math.round(ms / MIN);
  if (min < 60) return `in ~${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `in ~${hours}h`;
  const days = Math.round(hours / 24);
  return `in ~${days}d`;
}

function formatExact(ts: number): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
      hour12: true,
    }).format(new Date(ts)) + " IST";
  } catch {
    return new Date(ts).toLocaleString();
  }
}

function unknownInfo(tooltip: string): FreshnessInfo {
  return {
    state: "unknown",
    ageMs: Infinity,
    label: "no data yet",
    tooltip,
    exactLabel: "—",
    etaLabel: "queued",
    etaReason: "Waiting for its turn in the background refresh cycle.",
  };
}

export function getFreshness(
  lastUpdated: Date | string | number | null | undefined,
  isMarketOpen: boolean,
): FreshnessInfo {
  if (!lastUpdated) {
    return unknownInfo(
      "This stock hasn't been refreshed yet. It's queued in the background cycle — click ↻ to verify against Screener now.",
    );
  }

  const ts = lastUpdated instanceof Date ? lastUpdated.getTime() : new Date(lastUpdated).getTime();
  if (!Number.isFinite(ts)) {
    return unknownInfo("Last-updated timestamp is invalid.");
  }

  const ageMs = Math.max(0, Date.now() - ts);
  const label = formatAge(ageMs);
  const exactLabel = formatExact(ts);

  // Stale thresholds: 4h intraday / 24h after close.
  const veryStaleThreshold = isMarketOpen ? 4 * HOUR : 24 * HOUR;
  const staleThreshold = veryStaleThreshold / 2;

  // ETA: while market is open, live polling refreshes within seconds.
  // When market is closed, the rolling 24h seed cycle is the next touch.
  let etaMs: number;
  let etaReason: string;
  if (isMarketOpen) {
    etaMs = LIVE_POLL_MS;
    etaReason = "Live polling refreshes the watchlist every few seconds while the market is open.";
  } else {
    etaMs = Math.max(0, SEED_CYCLE_MS - ageMs);
    etaReason =
      "Background seeding refreshes every stock across a rolling 24h cycle. ETA is based on when this ticker was last touched.";
  }
  const etaLabel = formatEta(etaMs);

  if (ageMs >= veryStaleThreshold) {
    return {
      state: "very-stale",
      ageMs,
      label,
      exactLabel,
      etaLabel,
      etaReason,
      tooltip: isMarketOpen
        ? `Updated ${label} — older than 4h while the market is open. Next auto-refresh ${etaLabel}. Click ↻ to verify now.`
        : `Updated ${label} — older than 24h. Next auto-refresh ${etaLabel}. Click ↻ to verify now.`,
    };
  }

  if (ageMs >= staleThreshold) {
    return {
      state: "stale",
      ageMs,
      label,
      exactLabel,
      etaLabel,
      etaReason,
      tooltip: `Updated ${label}. Next auto-refresh ${etaLabel}.`,
    };
  }

  return {
    state: "fresh",
    ageMs,
    label,
    exactLabel,
    etaLabel,
    etaReason,
    tooltip: `Updated ${label} (${exactLabel}). Next auto-refresh ${etaLabel}.`,
  };
}

