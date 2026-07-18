# Migrating off Lovable Cloud to Supabase.com

This guide moves the EquityIQ backend from the Lovable-Cloud–managed Supabase
instance to a **standalone Supabase.com project** that you own and host.
The frontend code is unchanged — it already reads its backend URL and anon
key from environment variables, so migration is a matter of standing up the
new project, replaying schema + data + functions, and swapping the env vars.

You can host the same stack yourself on Render / a VPS by running the
[official Supabase docker-compose](https://supabase.com/docs/guides/self-hosting/docker);
the steps below are identical, only the "create the project" step differs.

---

## 0. What carries over vs. what you rebuild

| Carries over (via export bundle / CLI) | Rebuild in the new project |
| --- | --- |
| All `public.*` tables, RLS policies, functions, triggers | Auth users (or migrate via `auth.users` dump if you have DB owner access) |
| All row data (`profiles`, `user_watchlists`, `user_subscriptions`, etc.) | OAuth provider credentials (Google client id/secret) |
| Edge function source (`supabase/functions/*`) | Edge function secrets (`RAZORPAY_*`, `GROWW_API_TOKEN`, `LOVABLE_API_KEY`, …) |
| Storage bucket definitions | Storage bucket **contents** (re-upload) |
| `supabase/migrations/*` history | `pg_cron` schedules (re-create after DB restore) |

The **client-side encryption key** in `src/lib/stockData.ts` must remain
identical — it's what unlocks `user_watchlists.tickers` and
`portfolio_holdings` rows. Do not regenerate it.

---

## 1. Create the new Supabase.com project

1. Sign up at <https://supabase.com>, create an organization, click
   **New project**.
2. Pick a region close to your users (Mumbai `ap-south-1` for India).
3. Save the generated **database password** — you'll need it for `db push`.
4. Note the **Project Ref** (in the URL: `app.supabase.com/project/<ref>`)
   and the **anon** + **service_role** keys from *Project Settings → API*.

## 2. Apply the schema

You have two supported routes.

### Route A — Supabase CLI + migrations folder (recommended)

```bash
npm i -g supabase
supabase login
supabase link --project-ref <NEW_PROJECT_REF>
supabase db push        # replays /supabase/migrations/*
```

### Route B — Portable export bundle

If you already have `equityiq-db-export.zip` from a previous export:

```bash
unzip equityiq-db-export.zip -d dump
psql "postgres://postgres:<password>@db.<NEW_PROJECT_REF>.supabase.co:5432/postgres" \
     -f dump/schema.sql
```

## 3. Restore data

From the export bundle, load CSVs in dependency order (`profiles` first):

```bash
DBURL="postgres://postgres:<password>@db.<NEW_PROJECT_REF>.supabase.co:5432/postgres"

for t in profiles user_preferences user_subscriptions user_roles \
         user_watchlists portfolio_holdings shared_watchlists \
         app_reviews suppressed_emails email_unsubscribe_tokens \
         stock_universe cached_stock_prices sector_cache; do
  psql "$DBURL" -c "\copy public.$t FROM 'dump/$t.csv' WITH CSV HEADER"
done
```

If `auth.users` rows aren't restorable (Supabase.com doesn't allow arbitrary
inserts into `auth.users` via SQL), have users sign in once with the same
email. The `handle_new_user` trigger will recreate their `profiles` row;
match old rows by email and re-map `user_id` foreign keys before importing
watchlists.

## 4. Deploy edge functions

```bash
supabase functions deploy --project-ref <NEW_PROJECT_REF>
```

Then set the secrets each function needs (once per project):

```bash
supabase secrets set --project-ref <NEW_PROJECT_REF> \
  RAZORPAY_KEY_ID=... \
  RAZORPAY_KEY_SECRET=... \
  GROWW_API_TOKEN=... \
  LOVABLE_API_KEY=...
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and
`SUPABASE_DB_URL` are injected automatically — do not set them by hand.

## 5. Re-enable auth providers

In *Authentication → Providers*:

- Enable **Email + Password**. Turn on "Confirm email".
- Enable **Google** and paste your OAuth client id + secret.
- Under *URL Configuration*, set the **Site URL** to your production
  domain and add `http://localhost:8080` plus any preview URLs to the
  redirect allow-list.

## 6. Re-schedule cron jobs (only if you use them)

The daily price snapshot / email queue jobs live in `pg_cron`. They are
**not** in the migrations folder because the URL and service-role key are
project-specific. Re-create them from `SETUP` notes if you use them:

```sql
select cron.schedule(
  'process-email-queue', '5 seconds',
  $$ select public.email_queue_dispatch(); $$
);
```

## 7. Repoint the frontend

Update `.env` in the project root (see `.env.example`):

```bash
VITE_SUPABASE_URL=https://<NEW_PROJECT_REF>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<new anon key>
VITE_SUPABASE_PROJECT_ID=<NEW_PROJECT_REF>
```

Rebuild and redeploy the frontend (Vercel / Netlify / your host of choice):

```bash
npm run build
```

## 8. Smoke test

- Sign in with an existing user → watchlist decrypts and loads.
- Add a stock → row appears in `user_watchlists` in the new DB.
- Trigger a Razorpay test payment → `user_subscriptions.plan` flips.
- Send a transactional email → row lands in `email_send_log`.
- Promote your admin:
  ```sql
  insert into public.user_roles (user_id, role)
  values ('<uuid>', 'admin');
  ```

---

## Notes on the old Lovable-Cloud backend

Lovable Cloud stays attached to this Lovable project at the platform level
and cannot be detached from inside a chat. Once the new project is live and
verified, you can:

- **Pause** the old Cloud backend (Cloud settings) so it stops accruing
  usage. It won't be reachable, but the schema is preserved if you ever
  need to re-export.
- Leave `src/integrations/supabase/client.ts` as-is — it always reads from
  `.env`, so as long as `.env` points at the new project, the old Cloud
  URL/key are never used by the running app.

## Self-hosting on Render / a VPS (optional)

Instead of Supabase.com, you can run the same stack yourself:

1. Provision a Render **private service** or VPS with ≥ 2 GB RAM and a
   persistent disk (~20 GB to start).
2. Clone <https://github.com/supabase/supabase> and run
   `docker compose up -d` inside `docker/`.
3. Terminate TLS in front (Render's HTTPS, or Caddy/Traefik on a VPS).
4. From that point the steps above (schema, data, functions, env) are
   identical — just swap the `db.<ref>.supabase.co` host for your own.

Render's free web-service tier cannot run this — you need a paid instance
with a disk. Most people who want cheap self-hosting pick Hetzner /
Fly.io / Railway over Render for this specific workload.
