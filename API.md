# EquityIQ — Backend API Reference

Complete reference for every database table, RPC function, and Edge Function in the
backend (Supabase/Postgres + Deno Edge Functions), including request/response
examples and the frontend pages/hooks that consume them.

- **Frontend:** `src/` (React + Vite + Tailwind)
- **Backend:** `supabase/` (Postgres schema, RLS, RPCs, Edge Functions)
- Setup and deployment: see [`Setup.md`](./Setup.md)

Client used everywhere in the frontend:

```ts
import { supabase } from "@/integrations/supabase/client";
```

---

## Table of contents

1. [Conventions](#1-conventions)
2. [Database tables](#2-database-tables)
3. [RPC functions](#3-rpc-functions)
4. [Edge Functions](#4-edge-functions)
5. [Frontend → backend usage matrix](#5-frontend--backend-usage-matrix)

---

## 1. Conventions

### Auth model

| Access level | Meaning |
| --- | --- |
| `public` | Reachable without a session (Edge Function with `verify_jwt = false` and no in-code auth check) |
| `authenticated` | Requires a valid Supabase JWT in `Authorization: Bearer <access_token>` |
| `admin` | Requires `authenticated` **and** an `admin` row in `user_roles` |
| `service_role` | Server-only; never exposed to the browser |

`supabase.functions.invoke()` automatically attaches the current user's access
token, so authenticated functions need no manual header from the frontend.

### Standard error envelope

Every Edge Function returns JSON errors in the same shape:

```json
{ "error": "Unauthorized" }
```

Common statuses: `400` invalid input · `401` missing/invalid JWT ·
`403` not an admin · `404` not found · `410` expired · `500` internal error.

### Row-level security

All tables have RLS enabled. Unless stated otherwise, user-owned rows are scoped
with `user_id = auth.uid()`, so the frontend never filters by user manually for
writes — but reads still pass `.eq("user_id", user.id)` for index efficiency.

---

## 2. Database tables

### 2.1 `profiles`

User-facing profile record, auto-created on signup by the `handle_new_user` trigger.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `user_id` | uuid | Owner (auth user id) |
| `display_name` | text | Shown in header, emails, reviews |
| `avatar_url` | text | Optional |
| `email_opt_in` | boolean | Gate for non-critical emails |
| `created_at` / `updated_at` | timestamptz | |

**Access:** owner read/write. No delete policy.

**Read example** — `src/pages/Profile.tsx`

```ts
const { data } = await supabase
  .from("profiles")
  .select("display_name, email_opt_in")
  .eq("user_id", user.id)
  .maybeSingle();
```

```json
{ "display_name": "Ansik", "email_opt_in": true }
```

**Write example**

```ts
await supabase
  .from("profiles")
  .update({ display_name: "Ansik", email_opt_in: false })
  .eq("user_id", user.id);
```

**Used by:** `src/pages/Profile.tsx`, `src/pages/ProfileReviews.tsx`,
`src/contexts/AuthContext.tsx`, `src/components/ReviewDialog.tsx`,
`src/components/SmartAlerts.tsx` (opt-in check before digests).

---

### 2.2 `user_preferences`

Encrypted per-user app state: watchlist payload, notes, events, column config,
price triggers, and the auto-refresh toggle.

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | uuid | Owner |
| `watchlist` | text | Encrypted JSON blob of stocks |
| `notes` / `events` | text | Encrypted JSON |
| `column_visibility` | text | Encrypted JSON |
| `custom_columns` / `custom_column_data` | text | Premium dynamic columns |
| `price_triggers` | text | Encrypted JSON of alert rules |
| `auto_refresh_on_load` | boolean | Premium Plus auto-refresh toggle |

**Access:** owner read/write/insert. No delete.

**Upsert example** — `src/contexts/StockContext.tsx`

```ts
await supabase.from("user_preferences").upsert(
  {
    user_id: user.id,
    watchlist: encrypted,
    column_visibility: encryptedCols,
    auto_refresh_on_load: true,
  },
  { onConflict: "user_id" },
);
```

**Used by:** `src/contexts/StockContext.tsx` (load/persist/debounced save),
`src/pages/Profile.tsx` (auto-refresh toggle).

---

### 2.3 `user_watchlists`

Named watchlists. Insert is guarded by the `enforce_watchlist_quota` trigger.

| Column | Type | Notes |
| --- | --- | --- |
| `name` | text | Watchlist name |
| `tickers` | text | Encrypted JSON array |
| `is_default` | boolean | One default per user |

**Quota (enforced in DB):** free/expired `1` · pro `5` · premium `20` ·
premium plus `50` · legacy lifetime unlimited.

**Create example** — `src/hooks/useWatchlists.ts`

```ts
const { data, error } = await supabase
  .from("user_watchlists")
  .insert({ user_id: user.id, name: "Momentum", tickers: encrypted, is_default: false })
  .select()
  .single();
```

Quota breach response:

```json
{ "code": "23514", "message": "Watchlist quota exceeded for your plan (max 5)." }
```

**Used by:** `src/hooks/useWatchlists.ts` → `src/components/WatchlistManager.tsx`, dashboard (`src/pages/Index.tsx`).

---

### 2.4 `user_subscriptions`

Plan and trial state. Row is created by the `handle_new_subscription` trigger
with a 15-day trial.

| Column | Type | Notes |
| --- | --- | --- |
| `plan` | text | `free`, `monthly`, `yearly`, `premium_*`, `premium_plus_*`, `lifetime` |
| `status` | text | `trial`, `active`, `expired`, `cancelled` |
| `trial_ends_at` | timestamptz | |
| `subscription_starts_at` / `subscription_ends_at` | timestamptz | |
| `razorpay_payment_id` / `razorpay_order_id` | text | Payment audit |
| `amount_usd` / `amount_inr` | numeric | |

**Access:** owner read. Writes go through `razorpay-verify-payment` / `admin-users` (service role).

**Read example** — `src/hooks/useSubscription.ts`

```ts
const { data } = await supabase
  .from("user_subscriptions")
  .select("*")
  .eq("user_id", user.id)
  .maybeSingle();
```

```json
{
  "plan": "premium_plus_yearly",
  "status": "active",
  "trial_ends_at": null,
  "subscription_ends_at": "2027-03-01T00:00:00Z",
  "amount_usd": 400
}
```

**Used by:** `src/hooks/useSubscription.ts`, `src/pages/ProfileSubscription.tsx`,
`src/pages/Subscribe.tsx`, `src/components/SubscriptionGate.tsx`, `src/pages/RestrictedDashboard.tsx`.

---

### 2.5 `portfolio_holdings`

Premium portfolio positions.

| Column | Type | Notes |
| --- | --- | --- |
| `ticker` / `exchange` | text | `NSE` or `BSE` |
| `buy_price` / `quantity` | numeric | |
| `buy_date` | date | |
| `sector` | text | Filled from `sector_cache` / `sector-lookup` |

**Insert example** — `src/hooks/usePortfolio.ts`

```ts
await supabase.from("portfolio_holdings").insert({
  user_id: user.id,
  ticker: "TCS",
  exchange: "NSE",
  buy_price: 3450.5,
  quantity: 10,
  buy_date: "2026-01-14",
});
```

**Used by:** `src/hooks/usePortfolio.ts` → `src/pages/Portfolio.tsx`.

---

### 2.6 `cached_stock_prices`

Shared price cache (one row per ticker+exchange). Public read so guests see
prices instantly; writes only via `upsert-stock-prices`.

| Column | Type |
| --- | --- |
| `ticker`, `exchange`, `name` | text |
| `price`, `previous_close`, `change`, `change_percent` | numeric |
| `high`, `low`, `open_price` | numeric |
| `volume` | bigint |
| `market_cap`, `pe` | numeric |
| `updated_at` | timestamptz |

**Read example** — `src/contexts/StockContext.tsx`

```ts
const { data } = await supabase
  .from("cached_stock_prices")
  .select("*")
  .in("ticker", ["TCS", "INFY"]);
```

```json
[{
  "ticker": "TCS", "exchange": "NSE", "name": "Tata Consultancy Services",
  "price": 3502.4, "previous_close": 3480.1, "change": 22.3, "change_percent": 0.64,
  "high": 3515, "low": 3471.2, "open_price": 3486, "volume": 1843200,
  "market_cap": 1268000, "pe": 28.4, "updated_at": "2026-07-30T09:45:12Z"
}]
```

**Used by:** `src/contexts/StockContext.tsx`, `src/hooks/usePortfolio.ts`, `src/pages/SharedWatchlist.tsx` (indirectly).

---

### 2.7 `shared_watchlists`

Read-only public share links.

| Column | Type | Notes |
| --- | --- | --- |
| `share_token` | text | Random 8–128 char token, unique |
| `owner_id` | uuid | Creator |
| `watchlist_name` | text | |
| `tickers` | text | Snapshot |
| `stock_data` | jsonb | Frozen snapshot rendered on the share page |
| `expires_at` | timestamptz | Nullable |

**Create example** — `src/components/ShareExportButton.tsx`

```ts
await supabase.from("shared_watchlists").insert({
  share_token: token,
  owner_id: user.id,
  watchlist_name: "Momentum",
  tickers: JSON.stringify(tickers),
  stock_data: snapshot,
  expires_at: expiry,
});
```

Reads are done anonymously through the `get-shared-watchlist` Edge Function
(never directly from the browser).

**Used by:** `src/components/ShareExportButton.tsx` (write), `src/pages/SharedWatchlist.tsx` (read via function).

---

### 2.8 `app_reviews`

In-app ratings. Only approved reviews are publicly readable.

| Column | Type | Notes |
| --- | --- | --- |
| `rating` | integer | 1–5 |
| `review` | text | Body |
| `display_name`, `designation` | text | Shown on the landing page |
| `is_approved` | boolean | Moderation flag |

**Insert example** — `src/components/ReviewDialog.tsx`

```ts
await supabase.from("app_reviews").insert({
  user_id: user.id, rating: 5, review: "Best screener UX.",
  display_name: "Ansik", designation: "Retail investor",
});
```

**Used by:** `src/components/ReviewDialog.tsx`, `src/pages/ProfileReviews.tsx`, `src/pages/Landing.tsx` (approved reviews).

---

### 2.9 `sector_cache`

Ticker → sector map, populated by `sector-lookup`. Public read, service-role write.

```ts
const { data } = await supabase.from("sector_cache").select("ticker, sector").in("ticker", tickers);
```

```json
[{ "ticker": "TCS", "sector": "Information Technology" }]
```

**Used by:** `src/hooks/usePortfolio.ts`.

---

### 2.10 `stock_universe`

Master ticker list for seeding/search fallbacks (`ticker`, `exchange`, `segment`,
`name`, `bse_code`, `last_seeded_at`, `last_status`, `error_message`).

**Used by:** `src/components/admin/SeedUniverseWidget.tsx` (admin), `seed-stock-universe`.

---

### 2.11 `seed_job_progress`

Single-row (`id = 1`) progress tracker for the seeding job: `total`, `processed`,
`succeeded`, `failed`, `status`, `cycle_started_at`, `last_chunk_at`.

**Used by:** `src/components/admin/SeedUniverseWidget.tsx`.

---

### 2.12 `verification_debug_logs`

Diagnostics from `verify-stock-screener`: which source filled which field.

| Column | Type |
| --- | --- |
| `ticker`, `exchange`, `primary_source`, `bse_code` | text |
| `sources_used`, `source_fields`, `final_fields`, `final_values` | jsonb |
| `duration_ms` | integer |
| `error_message` | text |

**Used by:** `src/components/admin/VerificationDebugWidget.tsx` (read + "Clear debug logs" delete).

---

### 2.13 `stock_price_history`

Append-only price points (`ticker`, `exchange`, `price`, `recorded_at`).
Written by `upsert-stock-prices` during live market hours. Updates are denied.

---

### 2.14 Email infrastructure tables

| Table | Purpose | Access |
| --- | --- | --- |
| `email_send_log` | Delivery audit (`template_name`, `recipient_email`, `status`, `error_message`, `message_id`) | admin read, service write |
| `email_send_state` | Single row of throttling config: `batch_size`, `send_delay_ms`, TTLs, `retry_after_until` | service only |
| `email_unsubscribe_tokens` | One-click unsubscribe tokens (`token`, `email`, `used_at`) | service only |
| `suppressed_emails` | Suppression list (`email`, `reason`, `metadata`) | service only |

**Used by:** `auth-email-hook`, `send-transactional-email`, `process-email-queue`,
`handle-email-unsubscribe`; frontend touches them only through
`src/pages/Unsubscribe.tsx` and `src/pages/Profile.tsx` (re-subscribe).

---

### 2.15 `user_roles`

Role storage, deliberately separate from `profiles` to prevent privilege escalation.

| Column | Type |
| --- | --- |
| `user_id` | uuid |
| `role` | `app_role` enum: `admin` \| `moderator` \| `user` |

Checked through the security-definer helper `private.has_role(user_id, role)` inside RLS policies.

**Used by:** `src/hooks/useAdminRole.ts` → `src/pages/AdminDashboard.tsx`.

---

### 2.16 `app_settings`

Key/value app configuration (`key`, `value` jsonb, `updated_by`). Admin-managed.

---

## 3. RPC functions

Call pattern: `supabase.rpc("<name>", { ...args })`. All of these are
**backend-only** (service role from Edge Functions) except `private.has_role`,
which is invoked implicitly by RLS.

### 3.1 `enqueue_email(queue_name text, payload jsonb) → bigint`

Pushes an email job onto a `pgmq` queue (`auth_emails` or `transactional_emails`).

```ts
const { data } = await supabase.rpc("enqueue_email", {
  queue_name: "transactional_emails",
  payload: { template: "welcome", to: "user@example.com", props: { displayName: "Ansik" } },
});
// data → 4711  (message id)
```

**Called by:** `send-transactional-email`, `auth-email-hook`.

---

### 3.2 `read_email_batch(queue_name text, batch_size int, vt int) → setof (msg_id, read_ct, message)`

Leases a batch of queued emails for `vt` seconds.

```ts
const { data } = await supabase.rpc("read_email_batch", {
  queue_name: "auth_emails", batch_size: 10, vt: 60,
});
```

```json
[{ "msg_id": 4711, "read_ct": 1, "message": { "template": "recovery", "to": "user@example.com" } }]
```

**Called by:** `process-email-queue`.

---

### 3.3 `delete_email(queue_name text, message_id bigint) → boolean`

Acknowledges a processed message.

```ts
await supabase.rpc("delete_email", { queue_name: "auth_emails", message_id: 4711 });
// → true
```

**Called by:** `process-email-queue`.

---

### 3.4 `move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb) → bigint`

Moves a poisoned/expired message to the dead-letter queue and deletes the original.

```ts
await supabase.rpc("move_to_dlq", {
  source_queue: "transactional_emails",
  dlq_name: "transactional_emails_dlq",
  message_id: 4711,
  payload: { reason: "ttl_expired" },
});
// → 88 (new DLQ message id)
```

**Called by:** `process-email-queue`.

---

### 3.5 `email_queue_dispatch() → void`

Cron entry point (`process-email-queue` every 5 seconds while the queue is
non-empty). Honours `email_send_state.retry_after_until` and unschedules itself
when both queues drain. Not callable by `anon`/`authenticated`.

### 3.6 `email_queue_wake() → trigger`

Trigger fired on enqueue: arms the cron job and pokes `process-email-queue` immediately.

### 3.7 `handle_new_user() → trigger`

On `auth.users` insert: creates `profiles` + `user_preferences` rows.

### 3.8 `handle_new_subscription() → trigger`

On `auth.users` insert: creates a `user_subscriptions` row with `plan = free`,
`status = trial`, `trial_ends_at = now() + 15 days`.

### 3.9 `enforce_watchlist_quota() → trigger`

Before insert on `user_watchlists`: raises `check_violation` when the plan quota
is exceeded (see [§2.3](#23-user_watchlists)).

### 3.10 `update_updated_at_column() → trigger`

Generic `updated_at = now()` trigger used across tables.

### 3.11 `private.has_role(_user_id uuid, _role app_role) → boolean`

Security-definer role check used inside RLS policies to avoid recursive policy
evaluation. `EXECUTE` granted to `authenticated` only.

```sql
create policy "Admins can read" on public.email_send_log
for select to authenticated using (private.has_role(auth.uid(), 'admin'));
```

---

## 4. Edge Functions

Base URL: `${VITE_SUPABASE_URL}/functions/v1/<name>`.
Prefer `supabase.functions.invoke()` from the frontend.

| Function | Auth | Consumed by |
| --- | --- | --- |
| `stock-proxy` | public | `src/lib/growwApi.ts` → `StockContext` |
| `screener-search` | public | `AddStockDialog`, `Portfolio`, `StockContext` |
| `verify-stock-screener` | authenticated | `StockContext`, admin debug widget |
| `sector-lookup` | authenticated | `usePortfolio` |
| `upsert-stock-prices` | public (validated) | `StockContext` |
| `groww-proxy` | authenticated | `src/lib/growwApi.ts` (fallback) |
| `get-shared-watchlist` | public | `SharedWatchlist` |
| `razorpay-create-order` | authenticated | `Subscribe` |
| `razorpay-verify-payment` | authenticated | `Subscribe` |
| `send-transactional-email` | authenticated | `AuthContext`, `StockContext`, `SmartAlerts` |
| `handle-email-unsubscribe` | public / authenticated | `Unsubscribe`, `Profile` |
| `auth-email-hook` | Supabase hook | — (server) |
| `process-email-queue` | service (cron) | — (server) |
| `admin-users` | admin | `AdminDashboard` |
| `seed-stock-universe` | admin-triggered | `SeedUniverseWidget` |

---

### 4.1 `stock-proxy`

Aggregates live quotes from Yahoo Finance, Groww, NSE/BSE index feeds and
Screener, with per-field non-zero preference so cached values are never clobbered.

**Request**

```ts
const { data } = await supabase.functions.invoke("stock-proxy", {
  body: {
    symbols: [
      { ticker: "TCS", exchange: "NSE" },
      { ticker: "BSE_250_LARGEMIDCAP_INDEX", exchange: "BSE", isIndex: true },
    ],
  },
});
```

**Response** — keyed by `${exchange}_${ticker}`

```json
{
  "NSE_TCS": {
    "ltp": 3502.4, "open": 3486, "high": 3515, "low": 3471.2, "close": 3480.1,
    "volume": 1843200, "marketCap": 1268000, "pe": 28.4
  },
  "BSE_BSE_250_LARGEMIDCAP_INDEX": {
    "ltp": 11234.5, "open": 11190, "high": 11260, "low": 11170, "close": 11201,
    "volume": 0, "marketCap": 0, "pe": 24.1
  }
}
```

**Errors:** `400 { "error": "symbols array required" }`.

**Used by:** `src/lib/growwApi.ts` (`fetchStockQuotes`) → `src/contexts/StockContext.tsx`
(manual **Refresh Now**, initial load, and the 5s Premium Plus auto-refresh loop).

---

### 4.2 `screener-search`

Ticker/company search backed by Screener.in, with BSE numeric-code resolution
and index detection.

**Request**

```ts
const { data } = await supabase.functions.invoke("screener-search", { body: { query: "tata cons" } });
```

**Response**

```json
{
  "results": [
    { "ticker": "TCS", "name": "Tata Consultancy Services Ltd", "exchange": "NSE", "screenerCode": "TCS" },
    { "ticker": "TATACONSUM", "name": "Tata Consumer Products Ltd", "exchange": "NSE", "screenerCode": "TATACONSUM" },
    { "ticker": "BSE_250_LARGEMIDCAP_INDEX", "name": "BSE 250 LargeMidCap Index",
      "exchange": "BSE", "isIndex": true, "yahooSymbol": "^BSE250", "screenerCode": "540000" }
  ]
}
```

Empty/invalid query → `{ "results": [] }`. Upstream failure →
`{ "results": [], "error": "Screener API error" }`.

**Used by:** `src/components/AddStockDialog.tsx`, `src/pages/Portfolio.tsx` (holding search),
`src/contexts/StockContext.tsx` (resolving numeric/legacy tickers).

---

### 4.3 `verify-stock-screener`

Scrapes Screener.in (Google Finance fallback) to backfill missing fields and
writes a diagnostic row to `verification_debug_logs`.

**Request**

```ts
const { data } = await supabase.functions.invoke("verify-stock-screener", {
  body: { ticker: "BOHRAIND", exchange: "NSE" },
});
```

**Response (stock)**

```json
{
  "ok": true,
  "source": "screener",
  "verifiedAt": "2026-07-30T09:52:00Z",
  "data": { "ltp": 92.5, "open": 91, "high": 94.2, "low": 90.8, "close": 91.4,
            "volume": 12400, "marketCap": 210, "pe": 17.2 }
}
```

**Response (index — short-circuits)**

```json
{ "ticker": "BSE_250_LARGEMIDCAP_INDEX", "exchange": "BSE", "isIndex": true,
  "message": "Indices are served live by the stock-proxy and don't need Screener verification" }
```

**Errors:** `400 { "error": "Invalid ticker or exchange" }`, `500 { "error": "..." }`.

**Used by:** `src/contexts/StockContext.tsx` (automatic once-per-session tally
for stocks with missing fields) and `src/components/admin/VerificationDebugWidget.tsx`.

---

### 4.4 `sector-lookup` · authenticated

Resolves sectors for up to 20 tickers, reading `sector_cache` first and
persisting newly scraped values.

**Request**

```ts
const { data } = await supabase.functions.invoke("sector-lookup", { body: { tickers: ["TCS", "HDFCBANK"] } });
```

**Response**

```json
{ "TCS": "Information Technology", "HDFCBANK": "Banking" }
```

Unauthenticated → `401 { "error": "Unauthorized" }`. Empty/invalid input → `{}`.

**Used by:** `src/hooks/usePortfolio.ts` → sector allocation charts on `src/pages/Portfolio.tsx`.

---

### 4.5 `upsert-stock-prices`

Writes the shared price cache (max **200** rows per call) and appends
`stock_price_history` points during live market hours.

**Request**

```ts
await supabase.functions.invoke("upsert-stock-prices", {
  body: {
    rows: [{
      ticker: "TCS", exchange: "NSE", name: "Tata Consultancy Services",
      price: 3502.4, previous_close: 3480.1, change: 22.3, change_percent: 0.64,
      high: 3515, low: 3471.2, open_price: 3486, volume: 1843200,
      market_cap: 1268000, pe: 28.4,
    }],
  },
});
```

**Response**

```json
{ "ok": true, "upserted": 1 }
```

**Errors:** `400 { "error": "rows required" }`, `400 { "error": "too many rows (max 200)" }`.

**Used by:** `src/contexts/StockContext.tsx` after every successful live fetch.

---

### 4.6 `groww-proxy` · authenticated

Thin, validated passthrough to the Groww live-data API (server-held token).

**Request**

```ts
const { data } = await supabase.functions.invoke("groww-proxy", {
  body: { action: "quote", params: { exchange: "NSE", segment: "CASH", trading_symbol: "TCS" } },
});
```

Actions: `quote` (`exchange`, `segment`, `trading_symbol`), `ltp` and `ohlc`
(`segment`, `exchange_symbols` — comma-separated).

**Response** — raw Groww payload

```json
{ "status": "SUCCESS", "payload": { "last_price": 3502.4, "day_change": 22.3, "volume": 1843200 } }
```

**Errors:** `401 Unauthorized`, `400 { "error": "Invalid quote parameters" }`,
`400 { "error": "Invalid action" }`, `500 { "error": "API token not configured" }`.

---

### 4.7 `get-shared-watchlist` · public

Anonymous, token-scoped read of a shared watchlist snapshot (service role, so
`shared_watchlists` stays locked down).

**Request**

```ts
const { data } = await supabase.functions.invoke("get-shared-watchlist", { body: { token } });
// GET also supported: /functions/v1/get-shared-watchlist?token=<token>
```

**Response**

```json
{
  "watchlist_name": "Momentum",
  "stock_data": [{ "ticker": "TCS", "exchange": "NSE", "price": 3502.4, "changePercent": 0.64 }],
  "created_at": "2026-07-28T11:02:00Z"
}
```

**Errors:** `400 Invalid token` · `404 Not found` · `410 Expired`.

**Used by:** `src/pages/SharedWatchlist.tsx` (`/share/:token`).

---

### 4.8 `razorpay-create-order` · authenticated

Creates a Razorpay order, converting USD pricing to INR at a live FX rate
(fallback `83`).

Plan → USD: `monthly` 5 · `yearly` 50 · `premium_monthly` 20 ·
`premium_yearly` 200 · `premium_plus_monthly` 40 · `premium_plus_yearly` 400.

**Request**

```ts
const { data } = await supabase.functions.invoke("razorpay-create-order", {
  body: { plan: "premium_plus_yearly" },
});
```

**Response**

```json
{
  "order_id": "order_Ov3xR2kQ1a",
  "amount_inr": 3320000,
  "amount_usd": 400,
  "exchange_rate": 83,
  "key_id": "rzp_live_xxx"
}
```

`amount_inr` is in **paise**. Errors: `401 Unauthorized`, `400 Invalid plan`,
`500 Razorpay not configured`.

**Used by:** `src/pages/Subscribe.tsx`.

---

### 4.9 `razorpay-verify-payment` · authenticated

Verifies the HMAC-SHA256 signature and activates the subscription (service role
upsert on `user_subscriptions`, 30 or 365 days).

**Request**

```ts
await supabase.functions.invoke("razorpay-verify-payment", {
  body: {
    razorpay_order_id: "order_Ov3xR2kQ1a",
    razorpay_payment_id: "pay_Ov3yB8kL2c",
    razorpay_signature: "9f8a...",
    plan: "premium_plus_yearly",
    amount_usd: 400,
    amount_inr: 3320000,
    payment_method: "upi",
  },
});
```

**Response**

```json
{ "success": true, "plan": "premium_plus_yearly", "subscription_ends_at": "2027-07-30T09:55:00Z" }
```

With `is_test: true` the signature is verified but no subscription is written:

```json
{ "success": true, "message": "Test payment verified successfully! Gateway is working.", "is_test": true }
```

**Errors:** `401 Unauthorized`, `400 Invalid payment signature`, `500 Failed to update subscription`.

**Used by:** `src/pages/Subscribe.tsx` (Razorpay checkout handler).

---

### 4.10 `send-transactional-email` · authenticated

Renders a React Email template and enqueues it via `enqueue_email`.
Templates: `welcome`, `price_trigger_digest`, `smart_alert_digest`, `daily_summary`.
The last three are **non-critical** and are dropped when `profiles.email_opt_in`
is `false` or the address is suppressed.

**Request**

```ts
await supabase.functions.invoke("send-transactional-email", {
  body: {
    template: "price_trigger_digest",
    props: {
      displayName: "Ansik",
      alerts: [{ ticker: "TCS", condition: "above", target: 3500, price: 3502.4 }],
    },
  },
});
```

**Response**

```json
{ "success": true, "queued": true, "message_id": 4711 }
```

**Errors:** `401 Unauthorized`, `400 { "error": "Unknown template" }`,
`200 { "skipped": "opted_out" }` when the user disabled emails.

**Used by:** `src/contexts/AuthContext.tsx` (welcome), `src/contexts/StockContext.tsx`
(price triggers), `src/components/SmartAlerts.tsx` (smart alert digests).

---

### 4.11 `handle-email-unsubscribe` · public + authenticated

Three modes on one endpoint.

**Validate a token** (no `confirm`)

```ts
const { data } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
```

```json
{ "valid": true, "alreadyUnsubscribed": false, "email": "user@example.com" }
```

**Confirm unsubscribe**

```ts
await supabase.functions.invoke("handle-email-unsubscribe", { body: { token, confirm: true } });
```

```json
{ "success": true, "message": "Successfully unsubscribed" }
```

**Re-subscribe** (requires the user's own JWT)

```ts
await supabase.functions.invoke("handle-email-unsubscribe", {
  body: { action: "resubscribe", user_id: user.id },
});
```

```json
{ "success": true, "message": "Successfully re-subscribed" }
```

**Errors:** `400 Token is required`, `401 Unauthorized` (resubscribe for another user),
`200 { "error": "Invalid or expired token" }`.

**Used by:** `src/pages/Unsubscribe.tsx` (`/unsubscribe?token=…`), `src/pages/Profile.tsx` (opt-in toggle back on).

---

### 4.12 `auth-email-hook` · Supabase auth hook

Invoked by Supabase Auth (not the browser) for signup confirmation, magic link,
recovery, invite, email change and reauthentication. Renders the matching
template and calls `enqueue_email("auth_emails", …)`.

**Request (from Supabase)**

```json
{
  "user": { "email": "user@example.com" },
  "email_data": { "token_hash": "…", "email_action_type": "signup", "redirect_to": "https://app/auth" }
}
```

**Response:** `{}` on success — failures are logged and surfaced to Auth.

---

### 4.13 `process-email-queue` · service / cron

Drains `auth_emails` then `transactional_emails`: leases with
`read_email_batch`, sends via the provider, logs to `email_send_log`,
`delete_email`s on success, and `move_to_dlq`s on TTL expiry or retry exhaustion.
Backs off by writing `email_send_state.retry_after_until` on provider `429`s.

**Request:** `POST {}` with the service-role bearer and `Lovable-Context: cron`.

**Response**

```json
{ "processed": 7, "sent": 6, "failed": 1, "dlq": 0 }
```

---

### 4.14 `admin-users` · admin only

Called with an explicit `fetch` and the user's access token from the admin dashboard.

**List users** — `GET ?action=list`

```json
{
  "users": [{
    "id": "8f0…", "email": "user@example.com", "display_name": "Ansik",
    "email_confirmed_at": "2026-02-11T10:00:00Z", "created_at": "2026-02-11T09:58:00Z",
    "last_sign_in_at": "2026-07-30T08:12:00Z", "email_opt_in": true,
    "subscription_plan": "premium_plus_yearly", "subscription_status": "active",
    "is_admin": false, "trial_ends_at": null,
    "subscription_ends_at": "2027-03-01T00:00:00Z",
    "watchlist_count": 6, "last_active": "2026-07-30T08:20:00Z"
  }]
}
```

**Update subscription** — `POST ?action=update-subscription`

```json
{ "user_id": "8f0…", "plan": "premium_plus_yearly", "status": "active" }
```

→ `{ "success": true }`

**Delete user** — `POST ?action=delete` with `{ "user_id": "8f0…" }` → `{ "success": true }`

**Errors:** `401 Unauthorized`, `403 Forbidden` (not admin), `400 Invalid user ID` /
`Invalid plan or status` / `Unknown action`.

**Used by:** `src/pages/AdminDashboard.tsx`.

---

### 4.15 `seed-stock-universe` · admin-triggered

**`?action=ingest`** — pulls the NSE/BSE master lists into `stock_universe`.

```json
{ "ok": true, "action": "ingest", "inserted": 4821, "updated": 137 }
```

**`?action=process`** (default) — seeds the next chunk of stale tickers into the
price cache and updates `seed_job_progress`.

```json
{ "ok": true, "action": "process", "processed": 50, "succeeded": 48, "failed": 2 }
```

**Errors:** `400 { "error": "unknown action" }`, `500 { "error": "…" }`.

**Used by:** `src/components/admin/SeedUniverseWidget.tsx`.

---

## 5. Frontend → backend usage matrix

| Frontend page / module | Route | Tables | RPC (indirect) | Edge Functions |
| --- | --- | --- | --- | --- |
| `pages/Landing.tsx` | `/` | `app_reviews` | — | — |
| `pages/Auth.tsx` | `/auth` | — | `handle_new_user`, `handle_new_subscription` | `auth-email-hook` |
| `pages/Index.tsx` (dashboard) | `/dashboard` | `user_preferences`, `user_watchlists`, `cached_stock_prices` | `enforce_watchlist_quota` | `stock-proxy`, `screener-search`, `verify-stock-screener`, `upsert-stock-prices`, `send-transactional-email` |
| `components/AddStockDialog.tsx` | — | — | — | `screener-search` |
| `components/WatchlistManager.tsx` | — | `user_watchlists` | `enforce_watchlist_quota` | — |
| `components/ShareExportButton.tsx` | — | `shared_watchlists` | — | — |
| `components/SmartAlerts.tsx` | — | `profiles` | `enqueue_email` | `send-transactional-email` |
| `pages/SharedWatchlist.tsx` | `/share/:token` | — | — | `get-shared-watchlist` |
| `pages/Portfolio.tsx` | `/portfolio` | `portfolio_holdings`, `cached_stock_prices`, `sector_cache` | — | `sector-lookup`, `screener-search` |
| `pages/Profile.tsx` | `/profile` | `profiles`, `user_preferences` | — | `handle-email-unsubscribe` |
| `pages/ProfileSubscription.tsx` | `/profile/subscription` | `user_subscriptions` | — | — |
| `pages/ProfilePassword.tsx` | `/profile/password` | — | — | — |
| `pages/ProfileReviews.tsx` | `/profile/reviews` | `app_reviews`, `profiles` | — | — |
| `pages/Subscribe.tsx` | `/subscribe` | `user_subscriptions` | — | `razorpay-create-order`, `razorpay-verify-payment` |
| `pages/Unsubscribe.tsx` | `/unsubscribe` | — | — | `handle-email-unsubscribe` |
| `pages/AdminDashboard.tsx` | `/admin` | `user_roles`, `stock_universe`, `seed_job_progress`, `verification_debug_logs` | `private.has_role` | `admin-users`, `seed-stock-universe`, `verify-stock-screener` |
| `pages/FAQ.tsx`, `pages/Support.tsx` | `/faq`, `/support` | — | — | — |
| `contexts/AuthContext.tsx` | — | `profiles` | `handle_new_user` | `send-transactional-email` |
| `contexts/StockContext.tsx` | — | `user_preferences`, `cached_stock_prices` | — | `stock-proxy`, `screener-search`, `verify-stock-screener`, `upsert-stock-prices`, `send-transactional-email` |
| `hooks/useSubscription.ts` | — | `user_subscriptions` | — | — |
| `hooks/useWatchlists.ts` | — | `user_watchlists` | `enforce_watchlist_quota` | — |
| `hooks/usePortfolio.ts` | — | `portfolio_holdings`, `cached_stock_prices`, `sector_cache` | — | `sector-lookup` |
| `hooks/useAdminRole.ts` | — | `user_roles` | `private.has_role` | — |
| `lib/growwApi.ts` | — | — | — | `stock-proxy`, `groww-proxy` |
