// Centralized freshness logic for cached stock data.
// Thresholds: 4h during market hours, 24h after close.
// "very-stale" = beyond the threshold (warning); "stale" = approaching it (subtle hint).

export type FreshnessState = "fresh" | "stale" | "very-stale" | "unknown";

const HOUR = 60 * 60 * 1000;

export interface FreshnessInfo {
  state: FreshnessState;
  ageMs: number;
  /** Human-friendly age, e.g. "12 min ago", "5h ago", "2d ago". */
  label: string;
  /** Tooltip explanation tailored to state + market context. */
  tooltip: string;
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

export function getFreshness(
  lastUpdated: Date | string | number | null | undefined,
  isMarketOpen: boolean,
): FreshnessInfo {
  if (!lastUpdated) {
    return {
      state: "unknown",
      ageMs: Infinity,
      label: "no data yet",
      tooltip: "This stock hasn't been refreshed yet. Click the refresh icon to verify against Screener.",
    };
  }

  const ts = lastUpdated instanceof Date ? lastUpdated.getTime() : new Date(lastUpdated).getTime();
  if (!Number.isFinite(ts)) {
    return {
      state: "unknown",
      ageMs: Infinity,
      label: "no data yet",
      tooltip: "Last-updated timestamp is invalid.",
    };
  }

  const ageMs = Math.max(0, Date.now() - ts);
  const label = formatAge(ageMs);

  // Stale thresholds: 4h intraday / 24h after close.
  const veryStaleThreshold = isMarketOpen ? 4 * HOUR : 24 * HOUR;
  // "Stale" hint kicks in at half the very-stale threshold.
  const staleThreshold = veryStaleThreshold / 2;

  if (ageMs >= veryStaleThreshold) {
    return {
      state: "very-stale",
      ageMs,
      label,
      tooltip: isMarketOpen
        ? `Data is ${label} — older than 4h while the market is open. Click refresh to verify against Screener.`
        : `Data is ${label} — older than 24h. Click refresh to verify against Screener.`,
    };
  }

  if (ageMs >= staleThreshold) {
    return {
      state: "stale",
      ageMs,
      label,
      tooltip: `Updated ${label}. Live polling will refresh shortly; click the icon to force a Screener verify.`,
    };
  }

  return {
    state: "fresh",
    ageMs,
    label,
    tooltip: `Updated ${label}.`,
  };
}
