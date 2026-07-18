# Setup Guide — EquityIQ

This guide walks you through configuring and running EquityIQ from scratch, from cloning the repository to a fully working local (and optionally production) deployment.

---

## 📑 Table of Contents

- [Prerequisites](#-prerequisites)
- [1. Clone the Repository](#1-clone-the-repository)
- [2. Install Dependencies](#2-install-dependencies)
- [3. Environment Variables](#3-environment-variables)
- [4. Backend Setup (Supabase / Lovable Cloud)](#4-backend-setup-supabase--lovable-cloud)
- [5. Third-Party Integrations](#5-third-party-integrations)
- [6. Run the App Locally](#6-run-the-app-locally)
- [7. Seeding the Stock Universe](#7-seeding-the-stock-universe)
- [8. Admin Access](#8-admin-access)
- [9. Deployment](#9-deployment)
- [10. Cross-Platform Builds](#10-cross-platform-builds)
- [Troubleshooting](#-troubleshooting)

---

## ✅ Prerequisites

Install the following before you start:

- **Node.js** ≥ 20.x — [nodejs.org](https://nodejs.org)
- **Bun** ≥ 1.1 (preferred) or npm/pnpm — [bun.sh](https://bun.sh)
- **Git** — [git-scm.com](https://git-scm.com)
- **Supabase CLI** (for edge functions & migrations) — `npm i -g supabase`
- **Deno** ≥ 1.44 — required for testing/deploying edge functions locally — [deno.land](https://deno.land)
- A modern browser (Chrome, Firefox, Edge, or Safari)

Optional (for mobile / desktop builds):
- **Android Studio** — for Capacitor Android builds
- **Xcode** — for Capacitor iOS builds (macOS only)

---

## 1. Clone the Repository

```bash
git clone <your-repo-url> equityiq
cd equityiq
```

---

## 2. Install Dependencies

Using Bun (recommended):

```bash
bun install
```

Or with npm:

```bash
npm install
```

This installs all frontend dependencies listed in `package.json`.

---

## 3. Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Supabase / Lovable Cloud
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-public-key>
VITE_SUPABASE_PROJECT_ID=<project-ref>
```

> ℹ️ These are **publishable** keys and safe to expose in the browser bundle. Row Level Security (RLS) protects the data. The `service_role` key is **never** placed in the frontend.

### Backend Secrets (configured in Supabase Dashboard → Edge Functions → Secrets)

Set these on the backend, **not** in `.env`:

| Secret Name | Purpose |
|---|---|
| `RESEND_API_KEY` | Transactional email delivery |
| `RAZORPAY_KEY_ID` | Razorpay public key |
| `RAZORPAY_KEY_SECRET` | Razorpay signing secret |
| `RAZORPAY_WEBHOOK_SECRET` | Verifies incoming webhook signatures |
| `LOVABLE_API_KEY` | Lovable AI Gateway (auto-provisioned) |
| `ADMIN_EMAILS` | Comma-separated admin emails (optional) |

---

## 4. Backend Setup (Supabase / Lovable Cloud)

### 4.1 Create a Supabase Project

1. Sign up at [supabase.com](https://supabase.com) and create a new project.
2. Copy the **Project URL**, **anon key**, and **Project Ref** into your `.env` file.

### 4.2 Link the Supabase CLI

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

### 4.3 Apply Database Migrations

All schema, RLS policies, functions, triggers, and cron jobs live in `supabase/migrations/`.

```bash
supabase db push
```

This creates:
- Core tables: `profiles`, `user_roles`, `watchlists`, `watchlist_stocks`, `user_preferences`, `subscriptions`, `app_reviews`, `smart_alerts`, `price_alerts`, etc.
- Email queue infrastructure (`pgmq`, `email_send_log`, `suppressed_emails`)
- RLS policies + `GRANT`s for `authenticated`, `service_role`
- Security-definer functions (`has_role`, `enqueue_email`, quota enforcers)

### 4.4 Deploy Edge Functions

```bash
supabase functions deploy stock-proxy
supabase functions deploy verify-stock-screener
supabase functions deploy send-transactional-email
supabase functions deploy auth-email-hook
supabase functions deploy process-email-queue
supabase functions deploy handle-email-unsubscribe
supabase functions deploy razorpay-create-order
supabase functions deploy razorpay-verify-payment
supabase functions deploy razorpay-webhook
supabase functions deploy upsert-stock-prices
supabase functions deploy admin-lookup-user
```

> Deploy every function under `supabase/functions/`. Edge functions run on **Deno**, not Node.

### 4.5 Configure Auth

In the Supabase Dashboard:

1. **Authentication → Providers → Email**: Enable, require confirmation.
2. **Authentication → Providers → Google**: Enable and paste your Google OAuth `client_id` + `secret`.
3. **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:8080` (dev) or your production URL.
   - **Redirect URLs:** add both dev and prod origins.
4. **Authentication → Email Hooks**: Point the "Send Email" hook to the deployed `auth-email-hook` function URL (uses the same anon key for HMAC verification).

---

## 5. Third-Party Integrations

### 5.1 Resend (Transactional Email)

1. Create an account at [resend.com](https://resend.com).
2. Add and verify your sending domain (adds SPF/DKIM DNS records).
3. Create an API key and save it as `RESEND_API_KEY` in Supabase Edge Function Secrets.

### 5.2 Razorpay (Payments)

1. Sign up at [razorpay.com](https://razorpay.com), complete KYC.
2. From the Razorpay Dashboard → **API Keys**, generate a Key ID + Secret.
3. Save as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
4. Configure a webhook pointing to `https://<project-ref>.supabase.co/functions/v1/razorpay-webhook`, subscribing to `payment.captured`, `payment.failed`, `subscription.charged`. Save the webhook secret as `RAZORPAY_WEBHOOK_SECRET`.

### 5.3 Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Credentials**.
2. Create an **OAuth 2.0 Client ID** (type: Web application).
3. Add authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Paste the client ID/secret into the Supabase Google provider settings.

---

## 6. Run the App Locally

Start the Vite dev server:

```bash
bun run dev
# or
npm run dev
```

The app is now available at [http://localhost:8080](http://localhost:8080).

Optional — serve edge functions locally:

```bash
supabase functions serve --env-file supabase/.env
```

---

## 7. Seeding the Stock Universe

The universe of ~5,000 NSE + BSE tickers is populated via a one-time seed job.

1. Log in to the app.
2. Grant yourself the `admin` role (see [Admin Access](#8-admin-access)).
3. Navigate to **Admin Dashboard → Stock Seeding**.
4. Click **Start Seed Job**. Progress is tracked in the `seed_job_progress` table.

The seeder pulls from NSE/BSE public listings and normalizes symbols before insertion.

---

## 8. Admin Access

Admin roles are stored in the `user_roles` table (never on `profiles`).

To grant admin to your account, run this SQL in the Supabase SQL Editor:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<your-auth-uid>', 'admin');
```

Find your `auth.uid()` from **Authentication → Users** in the dashboard.

Admin capabilities:
- View & impersonate users, override subscriptions
- Trigger stock seed jobs, view verification debug logs
- Clear debug logs, manage feature flags

---

## 9. Deployment

### 9.1 Frontend (Vercel — recommended)

1. Push your repo to GitHub.
2. Import the project in [vercel.com](https://vercel.com).
3. Set the same `VITE_SUPABASE_*` env vars in **Project Settings → Environment Variables**.
4. Build command: `bun run build` (or `npm run build`). Output directory: `dist`.
5. Deploy.

SPA routing works out of the box on Vercel; no `vercel.json` rewrites are strictly required, but you can add:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/" }] }
```

### 9.2 Backend

Edge functions and the database are hosted on Supabase. Redeploy functions after any change:

```bash
supabase functions deploy <function-name>
```

Migrations promote to production via:

```bash
supabase db push
```

---

## 10. Cross-Platform Builds

### PWA
Already configured via `vite-plugin-pwa`. Users can install directly from the browser prompt.

### Android (Capacitor)

```bash
bun run build
npx cap sync android
npx cap open android
```

Build an APK/AAB from Android Studio.

### Desktop (Electron)

```bash
bun run electron:build
```

Produces installers under `dist-electron/`.

---

## 🩺 Troubleshooting

| Symptom | Fix |
|---|---|
| Blank page after publish | `.env` missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`. Restore them and rebuild. |
| Signup fails with "pwned" error | The chosen password appears in public breach corpora. Use a stronger passphrase. |
| "Unsupported provider: google" | Google OAuth is enabled in code but not configured in the Supabase dashboard. |
| Emails not sending | Verify `RESEND_API_KEY`, that the sending domain is verified, and that `process-email-queue` function is deployed. |
| Stock prices show as `—` | Edge function `stock-proxy` failed or is not deployed. Check function logs. |
| Admin widgets not visible | Your user is missing the `admin` role in `user_roles`. |
| RLS blocking queries | Confirm the table has both `GRANT`s and matching policies for the caller's role. |

---

## 📚 Further Reading

- [README.md](./README.md) — feature overview, use cases, and API documentation
- [Supabase Docs](https://supabase.com/docs)
- [Vite Docs](https://vitejs.dev)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

---

**You're all set!** 🚀 If you hit any snags, open an issue or reach out via the in-app Support page.
