export type DocSearchKind = "section" | "step" | "command" | "issue" | "limit";

export interface DocSearchEntry {
  /** Section anchor id on the /docs page */
  section: string;
  /** Human label of the section */
  sectionLabel: string;
  kind: DocSearchKind;
  title: string;
  body: string;
  /** Accordion item value to open when the hit is a troubleshooting issue */
  accordionValue?: string;
  keywords?: string;
}

export const DOC_SEARCH_INDEX: DocSearchEntry[] = [
  // Sections
  {
    section: "getting-started",
    sectionLabel: "Getting started",
    kind: "section",
    title: "Getting started",
    body: "Four steps from a blank account to a live watchlist. Sign up, verify, walkthrough, trial.",
    keywords: "signup register onboarding trial account",
  },
  {
    section: "watchlists",
    sectionLabel: "Watchlists & screener",
    kind: "section",
    title: "Watchlists & screener",
    body: "Add instruments, shape the table, sort, filter and refresh on your terms.",
    keywords: "screener table columns sort filter refresh",
  },
  {
    section: "favourites",
    sectionLabel: "Favourites",
    kind: "section",
    title: "Favourites",
    body: "A single starred set that cuts across every watchlist you own.",
    keywords: "star starred pinned",
  },
  {
    section: "alerts",
    sectionLabel: "Alerts & email",
    kind: "section",
    title: "Alerts & email",
    body: "Price triggers, Smart Alerts and digest emails with deduplication.",
    keywords: "notification digest smart alerts email opt-in",
  },
  {
    section: "sharing",
    sectionLabel: "Sharing & export",
    kind: "section",
    title: "Sharing & export",
    body: "Share links, PDF and image exports, and PWA installation.",
    keywords: "share export pdf image pwa install",
  },
  {
    section: "self-hosting",
    sectionLabel: "Self-hosting",
    kind: "section",
    title: "Self-hosting (Node.js)",
    body: "Node.js 20+ with npm and npx — setup, build and deploy commands.",
    keywords: "setup install deploy node npm npx supabase environment variables",
  },

  // Getting started steps
  {
    section: "getting-started",
    sectionLabel: "Getting started",
    kind: "step",
    title: "Create an account",
    body: "Create an account with email and password, or continue with Google.",
    keywords: "google oauth sign up login",
  },
  {
    section: "getting-started",
    sectionLabel: "Getting started",
    kind: "step",
    title: "Confirm the verification email",
    body: "Confirm the verification email — check spam if it does not arrive within a minute.",
    keywords: "verify confirm spam junk",
  },
  {
    section: "getting-started",
    sectionLabel: "Getting started",
    kind: "step",
    title: "Replay the guided walkthrough",
    body: "The guided walkthrough runs on first login and can be replayed from Profile at any time.",
    keywords: "tour onboarding walkthrough replay",
  },
  {
    section: "getting-started",
    sectionLabel: "Getting started",
    kind: "step",
    title: "15-day trial",
    body: "Every new account starts on a 15-day trial with full Pro access.",
    keywords: "trial pro plan free",
  },

  // Watchlist steps
  {
    section: "watchlists",
    sectionLabel: "Watchlists & screener",
    kind: "step",
    title: "Add stocks and indices",
    body: "Add stocks by NSE/BSE symbol; indices are supported alongside regular equities.",
    keywords: "ticker symbol nse bse index add",
  },
  {
    section: "watchlists",
    sectionLabel: "Watchlists & screener",
    kind: "step",
    title: "Sort and filter",
    body: "Sort any column, and filter by sector, price band or data completeness (Complete vs Partial).",
    keywords: "sort filter sector price range complete partial",
  },
  {
    section: "watchlists",
    sectionLabel: "Watchlists & screener",
    kind: "step",
    title: "Column customisation",
    body: "Choose which columns are visible — the layout is stored per user and encrypted.",
    keywords: "columns layout customise encrypted",
  },
  {
    section: "watchlists",
    sectionLabel: "Watchlists & screener",
    kind: "step",
    title: "Refresh Now and auto-refresh",
    body: "Use Refresh Now for an on-demand update; Premium Plus can enable a 5-second auto-refresh that pauses when the tab is hidden or the market is closed.",
    keywords: "refresh auto-refresh polling premium plus live prices",
  },
  {
    section: "watchlists",
    sectionLabel: "Watchlists & screener",
    kind: "limit",
    title: "Plan limits",
    body: "Free 1 × 20, Pro 5 × 20, Premium 20 × 50, Premium Plus 50 × 100 (watchlists × stocks per watchlist).",
    keywords: "quota limits plan pricing tier",
  },

  // Favourites
  {
    section: "favourites",
    sectionLabel: "Favourites",
    kind: "step",
    title: "Star a row",
    body: "Star any row to pin it across every watchlist.",
    keywords: "star favourite pin",
  },
  {
    section: "favourites",
    sectionLabel: "Favourites",
    kind: "step",
    title: "Favourites page",
    body: "The Favourites page shows live prices for starred tickers and supports one-click removal.",
    keywords: "favourites page live prices remove",
  },
  {
    section: "favourites",
    sectionLabel: "Favourites",
    kind: "step",
    title: "Cross-device sync",
    body: "Favourites sync to your account, so they follow you to any device.",
    keywords: "sync device account",
  },

  // Alerts
  {
    section: "alerts",
    sectionLabel: "Alerts & email",
    kind: "step",
    title: "Price triggers",
    body: "Price triggers fire when a stock crosses your upper or lower bound (Premium and above).",
    keywords: "price alert trigger threshold bound",
  },
  {
    section: "alerts",
    sectionLabel: "Alerts & email",
    kind: "step",
    title: "Smart Alerts",
    body: "Smart Alerts flag 52-week breaks and volume spikes using rolling averages with cooldowns, so the same signal is not repeated.",
    keywords: "smart alerts 52-week volume spike cooldown",
  },
  {
    section: "alerts",
    sectionLabel: "Alerts & email",
    kind: "step",
    title: "Email opt-in",
    body: "Digest emails respect the Email opt-in toggle in Profile — turning it off stops all digests.",
    keywords: "digest email opt-in unsubscribe",
  },

  // Sharing
  {
    section: "sharing",
    sectionLabel: "Sharing & export",
    kind: "step",
    title: "Export as image or PDF",
    body: "Export a watchlist as an image or PDF snapshot.",
    keywords: "export pdf png image snapshot",
  },
  {
    section: "sharing",
    sectionLabel: "Sharing & export",
    kind: "step",
    title: "Read-only share link",
    body: "Generate a read-only share link that works without an account.",
    keywords: "share link public read-only",
  },
  {
    section: "sharing",
    sectionLabel: "Sharing & export",
    kind: "step",
    title: "Install as a PWA",
    body: "Install the app to your home screen — it ships as a PWA on Android, iOS and desktop.",
    keywords: "pwa install home screen mobile android ios",
  },

  // Commands
  {
    section: "self-hosting",
    sectionLabel: "Self-hosting",
    kind: "command",
    title: "npm install",
    body: "Install project dependencies.",
    keywords: "dependencies node_modules setup",
  },
  {
    section: "self-hosting",
    sectionLabel: "Self-hosting",
    kind: "command",
    title: "npm run dev",
    body: "Start the local dev server on http://localhost:8080.",
    keywords: "development server vite local",
  },
  {
    section: "self-hosting",
    sectionLabel: "Self-hosting",
    kind: "command",
    title: "npm run build",
    body: "Create the production bundle in dist/.",
    keywords: "build production bundle dist",
  },
  {
    section: "self-hosting",
    sectionLabel: "Self-hosting",
    kind: "command",
    title: "npm run preview",
    body: "Serve the production build locally.",
    keywords: "preview serve production",
  },
  {
    section: "self-hosting",
    sectionLabel: "Self-hosting",
    kind: "command",
    title: "npm run lint",
    body: "Run eslint across the project.",
    keywords: "lint eslint code style",
  },
  {
    section: "self-hosting",
    sectionLabel: "Self-hosting",
    kind: "command",
    title: "npm run test",
    body: "Run the vitest test suite.",
    keywords: "test vitest unit tests",
  },
  {
    section: "self-hosting",
    sectionLabel: "Self-hosting",
    kind: "command",
    title: "npx supabase link --project-ref <project-ref>",
    body: "Link the local repository to your backend project.",
    keywords: "supabase link project ref backend cli",
  },
  {
    section: "self-hosting",
    sectionLabel: "Self-hosting",
    kind: "command",
    title: "npx supabase db push",
    body: "Apply pending database migrations to the linked project.",
    keywords: "database migration push schema sql",
  },
  {
    section: "self-hosting",
    sectionLabel: "Self-hosting",
    kind: "command",
    title: "npx supabase functions deploy",
    body: "Deploy all edge functions to the linked project.",
    keywords: "edge functions deploy serverless",
  },
  {
    section: "self-hosting",
    sectionLabel: "Self-hosting",
    kind: "step",
    title: "Setup.md and API.md",
    body: "Full architecture, environment variables and deployment steps live in Setup.md, with the backend reference in API.md.",
    keywords: "docs setup api env environment variables deployment vercel",
  },
];

/** Troubleshooting entries are indexed from the page so answers stay in one place. */
export function buildTroubleshootingEntries(
  items: { q: string; a: string }[]
): DocSearchEntry[] {
  return items.map((item, i) => ({
    section: "troubleshooting",
    sectionLabel: "Troubleshooting",
    kind: "issue" as const,
    title: item.q,
    body: item.a,
    accordionValue: `t-${i}`,
  }));
}

export function searchDocs(entries: DocSearchEntry[], rawQuery: string): DocSearchEntry[] {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 2) return [];
  const terms = query.split(/\s+/).filter(Boolean);

  const scored = entries
    .map((entry) => {
      const title = entry.title.toLowerCase();
      const body = entry.body.toLowerCase();
      const keywords = (entry.keywords ?? "").toLowerCase();
      const haystack = `${title} ${body} ${keywords}`;

      let score = 0;
      for (const term of terms) {
        if (!haystack.includes(term)) return null;
        if (title.startsWith(term)) score += 6;
        else if (title.includes(term)) score += 4;
        else if (keywords.includes(term)) score += 2;
        else score += 1;
      }
      if (entry.kind === "command") score += 1;
      return { entry, score };
    })
    .filter((x): x is { entry: DocSearchEntry; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  return scored.map((s) => s.entry);
}
