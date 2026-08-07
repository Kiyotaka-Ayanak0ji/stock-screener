# Changelog

## 2026-08-07

### Changed
- The monthly activity report is now an independent preference. Turning off
  general email updates no longer disables it, and the report job selects
  recipients on `monthly_report_opt_in` alone.
- Email sending is provider agnostic (`SMTP`, Resend, generic HTTP endpoint, or
  the legacy hosted API) and selected with `EMAIL_PROVIDER`.
- The auth email hook verifies Supabase "Send Email" hook requests with the
  Standard Webhooks scheme when `SEND_EMAIL_HOOK_SECRET` is set.
- Site name, site URL and sender identity moved from hard coded constants to
  `supabase/functions/_shared/site-config.ts`, driven by environment variables.
- Google sign in uses `supabase.auth.signInWithOAuth` directly.
- The dev only component tagger is loaded lazily, so builds succeed without it.

### Added
- `ARCHITECTURE.md`, `DEPLOYMENT.md`, `CHANGELOG.md`.
- `Dockerfile`, `docker/nginx.conf`, `docker-compose.yml` with health checks.
- Versioned migration system: `db/migrations/`, rollback scripts and
  `scripts/migrate.sh`, backed by the `public.schema_migrations` table.
- Full environment variable reference in `.env.example`.

### Removed
- `@lovable.dev/cloud-auth-js` and `src/integrations/lovable`.
- Hard coded cloud endpoints in the edge functions.

### Migration notes
Run `./scripts/migrate.sh up`. Existing accounts, preferences, settings and
report configuration are preserved; users who had all email switched off keep
the monthly report switched off.
