# Architecture

EquityIQ is a browser SPA in front of a small set of independently deployable
backend services. Nothing in the running application depends on Lovable cloud:
every endpoint, secret and sender identity is supplied through environment
variables.

## Service overview

| Service | Runtime | Port (default) | Responsibility |
| --- | --- | --- | --- |
| `web` | nginx serving the Vite build | 80 (8080 locally) | SPA delivery, SPA deep link rewrites, static caching |
| `auth` | Supabase GoTrue | 9999 | Accounts, sessions, email/password and Google OAuth, auth email hook dispatch |
| `rest` | PostgREST | 3000 | Data API for every `public` table, RLS enforced |
| `functions` | Deno edge runtime | 54321 (`/functions/v1/*`) | Market data proxies, payments, email pipeline, admin operations |
| `db` | Postgres 15 | 5432 | All persistent state, RLS policies, pgmq queues, pg_cron schedules |
| `mail` | Any SMTP server (Mailpit locally) | 1025 | Outbound email transport |

Only `web` is exposed publicly in a typical deployment; `auth`, `rest` and
`functions` sit behind the same reverse proxy on separate paths, and `db` and
`mail` stay on the private network.

## Service responsibilities

- **web** — presentation only. Reads `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` at build time. Holds no secrets; watchlists,
  columns and notes are encrypted client side before they leave the browser.
- **functions** — one Deno function per capability:
  - market data: `stock-proxy`, `groww-proxy`, `screener-search`,
    `sector-lookup`, `verify-stock-screener`, `upsert-stock-prices`,
    `seed-stock-universe`
  - payments: `razorpay-create-order`, `razorpay-verify-payment`
  - email: `auth-email-hook`, `send-transactional-email`,
    `send-monthly-reports`, `process-email-queue`, `handle-email-unsubscribe`
  - sharing and admin: `get-shared-watchlist`, `admin-users`
- **db** — schema, RLS, `private.has_role()` for policy checks, `enqueue_email`
  and friends over pgmq, and the pg_cron jobs that pump the email queue and
  trigger the monthly report.

## Communication flow

```
browser ──► reverse proxy ──► web (static SPA)
                │
                ├─► /auth/v1/*      ──► auth  ──► db
                ├─► /rest/v1/*      ──► rest  ──► db  (RLS)
                └─► /functions/v1/* ──► functions ──► db / external APIs

auth ──(Send Email hook, signed)──► functions/auth-email-hook ──► db queue
pg_cron ──► functions/process-email-queue ──► SMTP relay
pg_cron ──► functions/send-monthly-reports ──► db queue
```

All inter service traffic is HTTP over the private network; the only external
calls are to market data sources, the payment gateway and the SMTP relay, and
each of those is optional.

## Queue and event dependencies

- `pgmq` queues `auth_emails` and `transactional_emails` hold rendered emails.
- `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq` are
  `SECURITY DEFINER` wrappers used by the functions.
- `pg_cron` drains the queues every few seconds and runs the monthly report on
  the first of each month. Both jobs are database local, so they keep working
  without internet access; only the final SMTP hop needs a reachable relay.

## Health checks

| Service | Endpoint | Healthy response |
| --- | --- | --- |
| web | `GET /healthz` | `200 ok` |
| auth | `GET /auth/v1/health` | `200` JSON |
| rest | `GET /rest/v1/` | `200` |
| functions | `GET /functions/v1/stock-proxy?ticker=RELIANCE` | `200` JSON |
| db | `pg_isready -U postgres` | exit code `0` |

## Startup order

1. `db` (wait for `pg_isready`)
2. migrations (`./scripts/migrate.sh up`)
3. `auth`, `rest`, `functions` (in any order, all require `db`)
4. `mail`
5. `web`

## Networking requirements

- Inbound: 80/443 to the reverse proxy only.
- Internal: `web → auth/rest/functions`, `auth/rest/functions → db:5432`,
  `functions → mail:1025`.
- Outbound (optional): market data hosts, `api.razorpay.com`, SMTP relay.
  With no outbound access the app still runs: quotes fall back to cached
  prices, payments are disabled and email queues retry.

## Scaling

- `web` is stateless: scale horizontally behind the proxy.
- `rest` and `auth` are stateless: scale horizontally, size the Postgres
  connection pool (pgbouncer) accordingly.
- `functions` are stateless and per request; scale on CPU.
- `process-email-queue` is safe to run as a single scheduled worker; increase
  throughput with `email_send_state.batch_size` rather than more workers.
- `db` scales vertically first; add read replicas for reporting only.
