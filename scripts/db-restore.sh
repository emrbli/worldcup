#!/usr/bin/env bash
#
# db-restore.sh — load the bundled dataset (db/dump/worldcup.sql.gz) into the DB.
#
# Use this to (re)load the shipped data into an already-running database, or to
# reset to the bundled snapshot. The dump is created with --clean --if-exists,
# so it drops and recreates objects (safe to run on a populated DB).
# (On a brand-new `docker compose up` the dump auto-loads via the init mount;
# this script is for manual / repeat restores.)
#
# It targets, in order:
#   1) a local `psql` (using DATABASE_URL), else
#   2) the docker compose container `worldcup-pg` via `docker exec`.
#
# Usage:  pnpm db:restore        (or)  bash scripts/db-restore.sh
set -euo pipefail

cd "$(dirname "$0")/.."
DUMP="db/dump/worldcup.sql.gz"
[ -f "$DUMP" ] || { echo "FATAL: $DUMP not found"; exit 1; }

# Load DATABASE_URL from .env if present (for the psql path).
if [ -z "${DATABASE_URL:-}" ] && [ -f .env ]; then
  export "$(grep -E '^DATABASE_URL=' .env | head -1)"
fi

if command -v psql >/dev/null 2>&1 && [ -n "${DATABASE_URL:-}" ]; then
  echo "==> Restoring $DUMP via local psql → \$DATABASE_URL"
  gunzip -c "$DUMP" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1
elif docker ps --format '{{.Names}}' | grep -q '^worldcup-pg$'; then
  echo "==> Restoring $DUMP via docker exec (worldcup-pg)"
  gunzip -c "$DUMP" | docker exec -i worldcup-pg psql -U postgres -d worldcup -v ON_ERROR_STOP=1
else
  echo "FATAL: no 'psql' on PATH and the 'worldcup-pg' container is not running."
  echo "       Start the DB (docker compose up -d) or install the postgresql client."
  exit 1
fi

echo "==> Done. Verify with: pnpm dataset:verify"
