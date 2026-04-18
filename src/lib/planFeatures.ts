// Single source of truth for plan features and limits.
// Keep this in sync with the gating logic in src/hooks/useSubscription.ts.

export const PLAN_LIMITS = {
  guest: { watchlists: 1, stocks: 20 },
  pro: { watchlists: 5, stocks: 20 },
  premium: { watchlists: 20, stocks: 50 },
  premium_plus: { watchlists: Infinity, stocks: Infinity },
} as const;

export const PLAN_PRICING = {
  pro: { monthlyUsd: 5, yearlyUsd: 50 },
  premium: { monthlyUsd: 20, yearlyUsd: 200 },
  premium_plus: { monthlyUsd: 40, yearlyUsd: 450 },
} as const;

// Guest / Free tier — no signup payment.
export const GUEST_FEATURES = [
  "Up to 20 stocks in 1 watchlist",
  "Basic price data (NSE & BSE)",
  "Light & dark mode",
] as const;

// Features Guest does NOT have (used for cross-out lists on Landing).
export const GUEST_LOCKED = [
  "Multiple watchlists",
  "Smart Alerts",
  "Advanced filters (Price, Volume, P/E, Market Cap)",
  "Price triggers & email alerts",
  "Event tags & notes",
  "Export & sharing",
  "Portfolio dashboard",
] as const;

// Pro tier — what's included.
export const PRO_FEATURES = [
  "Up to 5 watchlists × 20 stocks each",
  "Real-time NSE & BSE price updates",
  "Column visibility customization",
  "Smart Alerts (52-week highs/lows & volume spikes)",
] as const;

// Features Pro does NOT have — Premium-gated (used for cross-out on Pro card).
export const PRO_LOCKED = [
  "Advanced filters (Price, Volume, Market Cap, P/E)",
  "Price triggers with email alerts",
  "Event tags & personal notes",
  "Export as Image & PDF",
  "Shareable watchlist links",
  "Portfolio dashboard with sector analysis",
] as const;

// Premium tier — everything in Pro plus these.
export const PREMIUM_EXTRAS = [
  "Up to 20 watchlists × 50 stocks each",
  "Advanced filters (Price, Volume, Market Cap, P/E)",
  "Price trigger alerts with email",
  "Event tagging & tracking",
  "Notes on stocks",
  "Export as Image & PDF",
  "Shareable watchlist links",
  "Portfolio dashboard",
  "Sector allocation & diversity score",
  "Stock-wise P&L charts",
  "Priority email support",
] as const;

// Premium Plus tier — everything in Premium plus these.
export const PREMIUM_PLUS_EXTRAS = [
  "Unlimited watchlists",
  "Unlimited stocks per watchlist",
  "Unlimited price trigger alerts",
  "Beta access to new features",
  "Priority customer support",
] as const;

// Map a feature name (free-text passed into PremiumDialog) to the minimum tier
// required so the dialog can show the right call-to-action.
export type RequiredTier = "pro" | "premium" | "premium_plus";

export function inferRequiredTier(featureName?: string): RequiredTier {
  if (!featureName) return "pro";
  const f = featureName.toLowerCase();

  // Premium Plus only.
  if (f.includes("unlimited")) return "premium_plus";

  // Premium-only features.
  const premiumKeywords = [
    "filter", "advanced filter",
    "price trigger", "trigger",
    "event tag", "tag",
    "note",
    "export", "image", "pdf",
    "share", "shareable",
    "portfolio", "sector",
    "p/e", "pe ratio",
  ];
  if (premiumKeywords.some((k) => f.includes(k))) return "premium";

  // Default — anything else (column visibility, extra watchlists, etc.) is Pro.
  return "pro";
}
