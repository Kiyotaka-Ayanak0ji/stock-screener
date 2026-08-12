# Deployment

Covers local development, Docker Compose, production Docker, a plain VPS,
reverse proxying, HTTPS, backups, migrations, upgrades and rollback.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the service map and startup order,
and [MIGRATION.md](./MIGRATION.md) for moving an existing database.

## 0. Two supported backends

The app talks to its backend only through three environment variables, so the
same codebase runs against either target without any code change:

| Mode | `VITE_SUPABASE_URL` | Managed by |
| --- | --- | --- |
| Hosted (Lovable Cloud) | the hosted project URL written into `.env` by the Cloud connection | Lovable Cloud |
| Fully local / self hosted | `http://localhost:54321` (or your own host) | you, via `npx supabase start` or the Docker stack |

Rules that keep both modes working:

- Never hardcode a URL or key in source. `src/integrations/supabase/client.ts`
  reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` only.
- The hosted `.env` is generated; keep a copy of your local values in
  `.env.local` (git-ignored) and switch by swapping the two variables.
- Schema parity comes from the same SQL: the baseline in
  `supabase/migrations/00000000000000_production_baseline.sql` plus everything
  in `db/migrations/`, applied by `./scripts/migrate.sh up`. The hosted project
  runs the identical files, so a local instance is a faithful replica.
- Edge functions in `supabase/functions/` are plain Deno HTTP handlers. Hosted
  deploys happen automatically; locally they are served by
  `npx supabase functions serve`.
- Every integration has an offline substitute: SMTP/Mailpit instead of a hosted
  mailer, and Razorpay/Groww keys are optional — those features simply stay off
  when the variables are unset.



## 1. Local development

```bash
git clone <your-fork-url> equityiq
cd equityiq
npm install
cp .env.example .env        # defaults already point at a local stack
npx supabase start          # db, auth, rest, functions on :54321
./scripts/migrate.sh up     # baseline + versioned migrations
npm run dev                 # http://localhost:8080
```

`npx supabase start` prints the anon key; copy it into
`VITE_SUPABASE_PUBLISHABLE_KEY`. Email is captured locally by Mailpit
(`docker compose up -d mail`, UI on <http://localhost:8025>) when
`EMAIL_PROVIDER=smtp` and `SMTP_HOST=localhost`, `SMTP_PORT=1025`.

## 2. Docker Compose

```bash
cp .env.example .env
docker compose up -d --build
./scripts/migrate.sh up
```

Services, ports and health checks are listed in ARCHITECTURE.md. Bring up the
Supabase services from the [official self hosting compose
file](https://supabase.com/docs/guides/self-hosting/docker) on the same Docker
network, then point `VITE_SUPABASE_URL` at that gateway.

## 3. Docker in production

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://api.example.com \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key> \
  --build-arg VITE_SUPABASE_PROJECT_ID=<ref> \
  -t equityiq-web:latest .
docker run -d --restart unless-stopped -p 8080:80 equityiq-web:latest
```

The Vite variables are inlined at build time, so a change to any of them
requires a rebuild, not just a restart.

## 4. Self hosted VPS

1. Provision at least 2 vCPU / 4 GB RAM and a persistent disk (20 GB+).
2. Install Docker and the compose plugin.
3. Clone the repo, create `.env`, run the Supabase self hosting stack.
4. `docker compose up -d --build && ./scripts/migrate.sh up`.
5. Deploy the functions: `npx supabase functions deploy --project-ref <ref>`
   (or mount `supabase/functions` into the self hosted edge runtime).
6. Put a reverse proxy in front (next section) and enable HTTPS.

## 5. Reverse proxy

Caddy (automatic HTTPS):

```caddy
example.com {
  handle /auth/v1/*      { reverse_proxy supabase-kong:8000 }
  handle /rest/v1/*      { reverse_proxy supabase-kong:8000 }
  handle /functions/v1/* { reverse_proxy supabase-kong:8000 }
  handle                 { reverse_proxy web:80 }
}
```

nginx equivalent:

```nginx
server {
  listen 443 ssl http2;
  server_name example.com;
  ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

  location ~ ^/(auth|rest|functions)/v1/ { proxy_pass http://supabase-kong:8000; }
  location / {
    proxy_pass http://web:80;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Recommendations: terminate TLS at the proxy, forward `X-Forwarded-*`, enable
gzip/brotli, and rate limit `/auth/v1/` and `/functions/v1/`.

## 6. HTTPS

Caddy issues and renews certificates automatically. With nginx use certbot:

```bash
certbot --nginx -d example.com -d www.example.com
```

After enabling HTTPS, set the auth Site URL and redirect allow list to the
`https://` origin, and update the Google OAuth authorised origins to match.

## 7. Environment variables

Every variable, its default and its purpose are documented in
[`.env.example`](./.env.example). Summary of the groups:

| Group | Variables | Notes |
| --- | --- | --- |
| Frontend | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SITE_URL` | Build time, public |
| Database | `DATABASE_URL` | Used by `scripts/migrate.sh`, backups |
| Branding | `SITE_NAME`, `SITE_URL`, `MAIL_FROM_DOMAIN`, `MAIL_SENDER_DOMAIN`, `MAIL_FROM_ADDRESS` | Function secrets |
| Email | `EMAIL_PROVIDER`, `SMTP_*`, `RESEND_API_KEY`, `EMAIL_HTTP_URL`, `EMAIL_HTTP_TOKEN` | Provider is pluggable |
| Auth hook | `SEND_EMAIL_HOOK_SECRET` | `v1,whsec_...` from the Send Email hook |
| Integrations | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `GROWW_API_TOKEN`, `MONTHLY_REPORT_CRON_SECRET` | All optional |

No secret is hard coded and no cloud URL is compiled into the app.

## 8. Backup strategy

```bash
# nightly logical backup
pg_dump "$DATABASE_URL" -Fc -f /backups/equityiq-$(date +%F).dump
# keep 30 days
find /backups -name 'equityiq-*.dump' -mtime +30 -delete
```

Back up storage bucket contents separately (`rsync`/`rclone` of the storage
volume). Store at least one copy off host.

## 9. Restore procedure

```bash
createdb -T template0 equityiq_restore
pg_restore -d equityiq_restore --no-owner /backups/equityiq-2026-08-01.dump
# verify, then point DATABASE_URL at the restored database and re run migrations
./scripts/migrate.sh up
```

## 10. Database migration workflow

- Baseline: `supabase/migrations/00000000000000_production_baseline.sql`,
  idempotent and non destructive.
- Versioned upgrades: `db/migrations/<version>_<name>.sql`.
- Rollbacks: `db/migrations/rollback/<version>_down.sql`.
- Bookkeeping: `public.schema_migrations` records applied versions and is
  backfilled automatically for databases created before it existed, which is
  how the previous schema version is detected.

```bash
./scripts/migrate.sh status          # applied vs on disk
./scripts/migrate.sh up              # apply pending, safe to re run
./scripts/migrate.sh down 20260807120000
```

Migrations never drop columns that hold user preferences, so re running or
rolling back cannot lose data.

## 11. Upgrade workflow

1. `pg_dump` the database (section 8).
2. `git pull` and rebuild the web image.
3. `./scripts/migrate.sh up`.
4. Redeploy the edge functions.
5. Restart `web`, then verify `/healthz` and a signed in page load.

## 12. Rollback procedure

1. Redeploy the previous web image tag and previous function revision.
2. If the release contained a migration, run
   `./scripts/migrate.sh down <version>`.
3. Only if data is corrupt, restore the dump from section 9.

## 13. Monitoring

- Poll the health endpoints in ARCHITECTURE.md from your uptime monitor.
- Track Postgres connections, slow queries and disk usage.
- Alert on `email_send_log.status = 'failed'` and on non empty DLQ queues.
- Alert on a growing `pgmq` queue depth, which means the cron pump has stopped.

## 14. Logging

- `web`: nginx access and error logs on stdout, collected by the container
  runtime.
- `functions`: `console.log`/`console.error` to the edge runtime log stream.
- `db`: enable `log_min_duration_statement = 500ms` for slow query visibility.
- Ship everything to your aggregator of choice (Loki, ELK, journald). Nothing
  is written to a Lovable endpoint.
