#!/usr/bin/env bash
# Versioned, idempotent migration runner for self hosted deployments.
#
#   ./scripts/migrate.sh up                 apply every pending migration
#   ./scripts/migrate.sh status             show applied vs pending versions
#   ./scripts/migrate.sh down <version>     run the rollback script for a version
#
# Requires DATABASE_URL (or SUPABASE_DB_URL) and psql on PATH.
set -euo pipefail

DB_URL="${DATABASE_URL:-${SUPABASE_DB_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASELINE="$ROOT/supabase/migrations/00000000000000_production_baseline.sql"
MIG_DIR="$ROOT/db/migrations"

applied_versions() {
  psql "$DB_URL" -tAc \
    "select version from public.schema_migrations order by version" 2>/dev/null || true
}

cmd="${1:-up}"

case "$cmd" in
  up)
    # The baseline is idempotent and non destructive, so it is always safe first.
    echo "==> applying baseline schema"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$BASELINE"

    applied="$(applied_versions)"
    for file in "$MIG_DIR"/*.sql; do
      [ -e "$file" ] || continue
      version="$(basename "$file" | cut -d_ -f1)"
      if echo "$applied" | grep -qx "$version"; then
        echo "==> $version already applied, skipping"
        continue
      fi
      echo "==> applying $version"
      psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$file"
    done
    echo "==> migrations up to date"
    ;;

  status)
    echo "applied:"; applied_versions | sed 's/^/  /'
    echo "on disk:"
    for file in "$MIG_DIR"/*.sql; do
      [ -e "$file" ] || continue
      echo "  $(basename "$file" | cut -d_ -f1)"
    done
    ;;

  down)
    version="${2:?usage: migrate.sh down <version>}"
    script="$MIG_DIR/rollback/${version}_down.sql"
    [ -f "$script" ] || { echo "no rollback script for $version" >&2; exit 1; }
    echo "==> rolling back $version"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$script"
    ;;

  *)
    echo "usage: migrate.sh [up|status|down <version>]" >&2
    exit 1
    ;;
esac
