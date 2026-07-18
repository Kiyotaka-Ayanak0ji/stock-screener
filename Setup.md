# EquityIQ — Setup Guide

Complete walkthrough for standing up EquityIQ locally and deploying it to
production. The app is a Vite + React SPA backed by Supabase (managed via
Lovable Cloud in the hosted build). It ships as an installable **PWA** —
no Electron or Capacitor build is required.

---

## 1. Tech Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18, Vite 5, TypeScript 5, Tailwind CSS 3, shadcn/ui, framer-motion |
| Data / cache | TanStack Query, React Context |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions on Deno) |
| Payments | Razorpay |
| Charts | Recharts |
| Testing | Vitest + Testing Library + jsdom |
| Delivery | PWA (installable, Add to Home Screen) |

---

## 2. Prerequisites

- **Node.js 20+** (or Bun 1.1+)
- **Git**
- A **Supabase** project (self-hosted or hosted) — or use Lovable Cloud, which provisions one automatically
- A **Razorpay** account (test mode is fine for local)
- Optional: **Deno 1.45+** if you want to run edge functions locally with the Supabase CLI

---

## 3. Clone & install

```bash
git clone <your-fork-url> equityiq
cd equityiq
npm install     # or: bun install
```

---

## 4. Environment variables

Create a `.env` file in the project root:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
VITE_SUPABASE_PROJECT_ID=<project-ref>
```

The URL and publishable (anon) key are safe to ship in the browser bundle;
Row Level Security protects the data. Never put the `service_role` key in
`.env` — it belongs only in edge function secrets.

### Edge function secrets

Set these in Supabase → Project Settings → Edge Functions → Secrets (or
via `supabase secrets set NAME=value`):

| Secret | Purpose |
| --- | --- |
| `SUPABASE_URL` | Auto-populated by Supabase |
| `SUPABASE_ANON_KEY` | Auto-populated |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-populated; used by admin functions |
| `SUPABASE_DB_URL` | Auto-populated |
| `LOVABLE_API_KEY` | AI gateway key (only if you use AI features) |
| `RAZORPAY_KEY_ID` | Razorpay public key |
| `RAZORPAY_KEY_SECRET` | Razorpay secret |
| `GROWW_API_TOKEN` | Optional live-quote provider token |

---

## 5. Database

### Option A — Supabase CLI (recommended)

```bash
npm i -g supabase
supabase login
supabase link --project-ref <project-ref>
supabase db push          # applies /supabase/migrations/*
```

### Option B — restore from the portable export bundle

If you have `equityiq-db-export.zip`:

```bash
unzip equityiq-db-export.zip -d dump
psql "$DATABASE_URL" -f dump/schema.sql
for f in dump/*.csv; do
  t=$(basename "$f" .csv)
  psql "$DATABASE_URL" -c "\copy public.$t FROM '$f' WITH CSV HEADER"
done
```

Load `profiles` before any table that references `user_id`.

### Row Level Security

Every user-facing table ships with RLS enabled and per-user policies. Do
not disable RLS in production. The `has_role()` helper lives in the
`private` schema; only `authenticated` has `EXECUTE`.

---

## 6. Authentication

In Supabase → Authentication → Providers:

- Enable **Email + Password**. Confirm email flow is on.
- Enable **Google** OAuth and add your OAuth client. Redirect URL:
  `https://<your-domain>/` (and `http://localhost:8080/` for local).
- Under **URL Configuration** set the Site URL and the additional
  redirect URLs for your custom domain and preview URLs.

---

## 7. Edge functions

Functions live in `supabase/functions/*`. Deploy all at once:

```bash
supabase functions deploy --no-verify-jwt
```

Or one by one, e.g. `supabase functions deploy stock-proxy`. Each
function's `config.toml` inside `supabase/config.toml` controls whether
JWT verification runs at the edge; most Lovable-managed functions use
in-code JWT validation instead.

Public functions used by the app:

- `stock-proxy`, `groww-proxy`, `screener-search`, `sector-lookup`,
  `verify-stock-screener`, `upsert-stock-prices`
- `razorpay-create-order`, `razorpay-verify-payment`
- `send-transactional-email`, `process-email-queue`, `handle-email-unsubscribe`,
  `auth-email-hook`
- `admin-users`, `seed-stock-universe`
- `get-shared-watchlist`

---

## 8. Run the app locally

```bash
npm run dev
# → http://localhost:8080
```

Other scripts:

```bash
npm run build          # production build to /dist
npm run build:dev      # dev-mode build (source maps, no minify)
npm run preview        # serve /dist locally
npm run lint
npm run test           # vitest
```

---

## 9. PWA (Install to Home Screen)

EquityIQ is delivered as a **manifest-only PWA** — no service worker,
no offline cache, no Electron/Capacitor build.

Files that make it installable:

- `public/manifest.json` — name, colors, icons, `display: standalone`
- `public/icons/icon-192.png`, `icon-512.png` — home-screen icons
- `index.html` — `<link rel="manifest">`, `theme-color`,
  `apple-mobile-web-app-*` meta tags, `apple-touch-icon`

### How users install it

- **Android (Chrome/Edge):** menu → *Install app* / *Add to Home screen*
- **iOS (Safari):** Share sheet → *Add to Home Screen*
- **Desktop (Chrome/Edge/Brave):** install icon in the address bar

The installed app launches full-screen from a home-screen icon and shares
storage with the browser — sign-in state carries over.

### Updating an installed PWA

Because there is no service worker cache, the installed app always
fetches fresh HTML on launch. iOS caches manifest fields (`start_url`,
`scope`, `display`, `id`) at install time; changing them may require
users to reinstall.

---

## 10. Deployment

### Frontend (Vercel — recommended)

1. Import the repo into Vercel.
2. Framework preset: **Vite**. Build command `npm run build`, output `dist`.
3. Add the three `VITE_SUPABASE_*` env vars for **Preview** and **Production**.
4. Deploy. SPA routing is handled by `vercel.json`.

### Backend (Supabase)

Migrations and edge functions deploy through the Supabase CLI as shown
above. Set the secrets listed in Section 4 in the target project.

### Custom domain

Add it in Vercel → Domains and update Supabase's Site URL + redirect URLs
to match.

---

## 11. Post-deploy checklist

- Sign up a real user → verify email → confirm `profiles`,
  `user_preferences`, `user_subscriptions` rows exist (created by the
  `handle_new_user` and `handle_new_subscription` triggers).
- Add a stock to a watchlist → refresh → data persists (encrypted).
- Trigger a Razorpay test payment → `user_subscriptions.plan` flips.
- Install the PWA on a phone from the deployed URL.
- Promote your admin user:
  ```sql
  INSERT INTO public.user_roles (user_id, role)
  VALUES ('<uuid>', 'admin');
  ```

---

## 12. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Blank published app | `.env` missing `VITE_SUPABASE_*` at build time — reconnect Supabase and rebuild |
| `permission denied for table X` | Missing `GRANT` in a migration; grant `authenticated` the needed privileges |
| Admin login fails after security hardening | Ensure `authenticated` has `USAGE` on `private` and `EXECUTE` on `private.has_role` |
| Google sign-in error "Unsupported provider" | Google provider not enabled in Supabase Auth |
| Install prompt never appears | Serve over HTTPS, valid manifest, 192 + 512 icons, visit the site at least once |
| Stale data after redeploy | Hard-refresh; there is no service worker to purge |
