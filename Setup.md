# EquityIQ — Architecture & Setup Guide

Everything you need to understand the codebase (frontend vs backend),
run it locally, and host it online.

- App type: Vite + React SPA (installable PWA)
- Backend: Supabase (Postgres + Auth + Storage + Deno Edge Functions)
- No Electron, no Capacitor, no service worker

---

## 1. Repository layout — frontend vs backend

```text
equityiq/
├── index.html                  # FRONTEND  SPA shell, meta tags, PWA manifest link
├── vite.config.ts              # FRONTEND  build/dev server (port 8080, "@" alias)
├── tailwind.config.ts          # FRONTEND  design tokens (dark, teal #148a9e)
├── vercel.json                 # HOSTING   SPA rewrite for deep links
├── public/                     # FRONTEND  static assets
│   ├── manifest.json           #   PWA manifest (standalone, icons)
│   ├── icons/                  #   192 / 512 home-screen icons
│   └── docs/                   #   README screenshots
│
├── src/                        # ================= FRONTEND =================
│   ├── main.tsx                #   React root
│   ├── App.tsx                 #   Router + global providers
│   ├── index.css               #   Design system tokens (HSL CSS vars)
│   ├── pages/                  #   One file per route (see §2)
│   ├── components/             #   Feature components (watchlist, alerts, share…)
│   │   ├── ui/                 #     shadcn/ui primitives
│   │   └── admin/              #     Admin-only widgets (seeding, debug logs)
│   ├── contexts/               #   AuthContext, StockContext, ThemeContext
│   ├── hooks/                  #   useSubscription, useWatchlists, usePortfolio,
│   │                           #   useAdminRole, use-mobile, use-toast
│   ├── lib/                    #   growwApi, stockData, stockFreshness,
│   │                           #   planFeatures (tier limits & pricing), utils
│   ├── integrations/supabase/  #   Generated client + DB types (do not edit)
│   └── test/                   #   Vitest setup + tests
│
└── supabase/                   # ================= BACKEND ==================
    ├── config.toml             #   Project ref + per-function JWT settings
    ├── migrations/             #   Ordered SQL: tables, RLS, grants, functions
    └── functions/              #   Deno edge functions (see §3)
        └── _shared/            #   auth helpers + React Email templates
```

Rule of thumb: **everything under `src/` runs in the browser; everything
under `supabase/` runs on the server.** The only bridge between them is
`src/integrations/supabase/client.ts`, which reads the three public
`VITE_SUPABASE_*` env vars.

---

## 2. Frontend

### Stack

| Concern | Choice |
| --- | --- |
| UI | React 18, TypeScript 5, Vite 5 |
| Styling | Tailwind CSS 3 + shadcn/ui (Radix), framer-motion |
| Data | TanStack Query, React Context |
| Routing | React Router v6 |
| Charts / export | Recharts, html2canvas, jsPDF |
| Forms | react-hook-form + Zod |
| Tests | Vitest + Testing Library + jsdom |

### Routes

| Route | Page | Access |
| --- | --- | --- |
| `/` | `Landing.tsx` | Public |
| `/auth` | `Auth.tsx` (email+password, Google OAuth) | Public |
| `/dashboard` | `Index.tsx` — watchlist screener | Auth |
| `/portfolio` | `Portfolio.tsx` | Premium |
| `/profile` | `Profile.tsx` (prefs, linked accounts) | Auth |
| `/profile/subscription` | `ProfileSubscription.tsx` | Auth |
| `/profile/password` | `ProfilePassword.tsx` | Auth |
| `/profile/reviews` | `ProfileReviews.tsx` | Auth |
| `/subscribe` | `Subscribe.tsx` — Razorpay checkout | Auth |
| `/admin` | `AdminDashboard.tsx` | Admin role |
| `/shared/:token` | `SharedWatchlist.tsx` | Public |
| `/faq`, `/support` | `FAQ.tsx`, `Support.tsx` | Public |
| `/unsubscribe` | `Unsubscribe.tsx` | Public |

### State ownership

- `AuthContext` — session, email-verification gate, sign-in/out.
- `StockContext` — the single source of truth for quotes: initial session
  fetch, manual **Refresh Now**, and the Premium Plus 5-second auto-refresh
  all funnel through one `fetchAndApplyLive` call (in-flight guard, pauses
  on hidden tab, market-hours gated).
- `useSubscription` / `planFeatures.ts` — tier limits (Free 1×10,
  Premium 10×50, Premium Plus 50×100, Lifetime 50×100) and pricing.
- Watchlists, columns and notes are **encrypted client-side** before persistence.

---

## 3. Backend

### Database (Postgres, RLS everywhere)

| Table | Purpose |
| --- | --- |
| `profiles` | Display name and profile data |
| `user_preferences` | Email opt-in, auto-refresh toggle, UI prefs |
| `user_subscriptions` | Plan, status, trial end, Razorpay refs |
| `user_roles` | RBAC (`user` / `moderator` / `admin`) |
| `user_watchlists` | Encrypted watchlist payloads |
| `portfolio_holdings` | Ticker, quantity, buy price |
| `price_alerts` | Upper/lower price triggers |
| `app_reviews` | In-app reviews |
| `verification_debug_logs` | Admin diagnostics |
| pgmq queues | `q_auth_emails`, `q_transactional_emails` |

Key server-side functions: `handle_new_user`, `handle_new_subscription`,
`enforce_watchlist_quota` (plan limits enforced in the DB, not just the UI),
`email_queue_wake` / `email_queue_dispatch` (pg_cron-driven email pump),
and `private.has_role()` — a `SECURITY DEFINER` helper used by RLS policies
to avoid recursion. `authenticated` needs `USAGE` on `private` and
`EXECUTE` on `private.has_role`.

Every table has RLS enabled with per-user policies plus explicit `GRANT`s.
Never disable RLS in production.

### Edge functions (`supabase/functions/*`, Deno)

| Function | JWT | Role |
| --- | --- | --- |
| `stock-proxy` | no | Primary quote resolver (NSE/BSE/Yahoo, index handling) |
| `groww-proxy` | no | Alternate quote source |
| `screener-search` | no | Ticker/company search |
| `sector-lookup` | no | Sector metadata |
| `verify-stock-screener` | no | Cross-check quotes vs Screener.in |
| `upsert-stock-prices` | no | Persists ticks during IST market hours |
| `seed-stock-universe` | yes | Bulk-load the NSE/BSE universe (admin) |
| `razorpay-create-order` | no | Creates a subscription order |
| `razorpay-verify-payment` | no | Verifies signature, activates plan |
| `send-transactional-email` | no | Templated email (gated by `email_opt_in`) |
| `process-email-queue` | yes | Drains pgmq digest queues |
| `handle-email-unsubscribe` | no | One-click opt-out |
| `auth-email-hook` | no | Supabase Auth email webhook |
| `get-shared-watchlist` | no | Read-only watchlist by share token |
| `admin-users` | yes | Admin user/subscription management |

`verify_jwt` per function is set in `supabase/config.toml`; functions that
are "public" still validate tokens in code where needed
(`supabase/functions/_shared/auth.ts`).

---

## 4. Prerequisites

- Node.js 20+ (npm 10+) and Git — the project standardizes on npm/npx
- A Supabase project (Supabase.com or self-hosted)
- Supabase CLI via `npx supabase ...` (no global install needed) for migrations/functions
- A Razorpay account (test mode works locally)
- Optional: Deno 1.45+ to run functions locally

---

## 5. Local setup

```bash
git clone <your-fork-url> equityiq
cd equityiq
npm install
```

### 5.1 Frontend environment

Create `.env` in the project root (see `.env.example`):

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
VITE_SUPABASE_PROJECT_ID=<project-ref>
```

These three are safe in the browser bundle — RLS protects the data.
Vite inlines them at **build time**, so rebuild after changing them.
The `service_role` key must never appear here.

### 5.2 Backend: database

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push          # applies supabase/migrations/*
```

Restoring from the portable export bundle instead:

```bash
unzip equityiq-db-export.zip -d dump
psql "$DATABASE_URL" -f dump/schema.sql
for f in dump/*.csv; do
  t=$(basename "$f" .csv)
  psql "$DATABASE_URL" -c "\copy public.$t FROM '$f' WITH CSV HEADER"
done
```

Load `profiles` before any table referencing `user_id`.

### 5.3 Backend: secrets

Set in Supabase → Project Settings → Edge Functions → Secrets, or
`npx supabase secrets set NAME=value`:

| Secret | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_URL` | Auto-populated |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-populated; admin functions only |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Payments |
| `GROWW_API_TOKEN` | Optional live-quote provider |
| `LOVABLE_API_KEY` | Only if AI features are enabled |
| `RESEND_API_KEY` | Transactional email delivery |

### 5.4 Backend: auth providers

Supabase → Authentication:

- **Email + Password** enabled, confirm-email ON (the app hard-gates on it).
- **Google** OAuth enabled with your client ID/secret.
- URL Configuration → Site URL `http://localhost:8080` locally, your domain
  in production; add both to Additional Redirect URLs.

### 5.5 Backend: edge functions

```bash
npx supabase functions deploy                 # all
npx supabase functions deploy stock-proxy     # one
npx supabase functions serve stock-proxy      # run locally on :54321
```

### 5.6 Run the frontend

```bash
npm run dev        # http://localhost:8080
npm run build      # production bundle → /dist
npm run preview    # serve /dist
npm run lint
npm run test
```

---

## 6. Hosting online

### 6.1 Frontend — Vercel (recommended)

1. Import the repo; preset **Vite**, build `npm run build`, output `dist`.
2. Add the three `VITE_SUPABASE_*` vars for Preview **and** Production.
3. Deploy. `vercel.json` handles SPA deep-link rewrites.

Netlify/Cloudflare Pages work identically — build `npm run build`,
publish `dist`, and add a catch-all rewrite to `/index.html`.

### 6.2 Backend — Supabase

The backend is hosted by Supabase itself; there is no server to deploy.
Per environment: run `supabase db push`, `supabase functions deploy`,
set the secrets from §5.3, and configure auth URLs from §5.4.
Scheduled work (email queue pump) runs through `pg_cron` inside the DB.

### 6.3 Custom domain

Add the domain in your host's dashboard, then update Supabase Site URL and
redirect URLs (and the Google OAuth authorized origins) to match.

### 6.4 PWA

Manifest-only PWA — `public/manifest.json`, `public/icons/*`, plus the
`theme-color` / `apple-mobile-web-app-*` tags in `index.html`.
Install via Chrome's address-bar icon, Android "Install app", or iOS
Share → Add to Home Screen. No service worker, so a redeploy is picked up
on next launch; iOS caches `start_url`/`scope`/`display` at install time.

---

## 7. Post-deploy checklist

- Sign up → verify email → confirm `profiles`, `user_preferences`,
  `user_subscriptions` rows were created by triggers.
- Sign in with Google, then link/unlink it from `/profile`.
- Add a stock, reload → watchlist persists (encrypted).
- Run a Razorpay test payment → `user_subscriptions.plan` flips.
- Promote an admin:
  ```sql
  INSERT INTO public.user_roles (user_id, role) VALUES ('<uuid>', 'admin');
  ```
- Install the PWA from the deployed URL on a phone.

---

## 8. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Blank published app | `VITE_SUPABASE_*` missing at build time — set vars and rebuild |
| `permission denied for table X` | Missing `GRANT` in a migration for `authenticated` |
| Admin login fails | Grant `USAGE` on `private` + `EXECUTE` on `private.has_role` to `authenticated` |
| Google sign-in "Unsupported provider" | Provider not enabled in Supabase Auth |
| OAuth redirects to the wrong origin | Add the origin to Supabase redirect URLs and Google authorized origins |
| Quotes empty for a ticker/index | Check `stock-proxy` logs; verify via the admin Stock Debug Panel |
| Emails not arriving | User has `email_opt_in` off, or `RESEND_API_KEY` unset; check `process-email-queue` logs |
| Install prompt never appears | Needs HTTPS, valid manifest, 192+512 icons, one prior visit |
