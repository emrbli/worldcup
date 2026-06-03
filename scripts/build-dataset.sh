#!/usr/bin/env bash
#
# build-dataset.sh — ONE command to (re)build the entire WorldCup dataset.
#
# Idempotent + resilient: safe to re-run any time. Foundation steps (migrate,
# core seed) fail hard; enrichment steps (content, squads, FIFA sync, crawlers)
# are fail-soft — a single flaky upstream source logs a WARN and the build
# continues. The final `dataset:verify` is the source of truth and exits
# non-zero only if a CORE tournament table is wrong.
#
# Prereqs on the server: Node + pnpm, Python 3.10+, a running Postgres, and a
# `.env` with DATABASE_URL (+ FOOTBALL_DATA_TOKEN for squads). FIFA env vars
# fall back to sane defaults.
#
# Usage:  pnpm dataset:build      (or)   bash scripts/build-dataset.sh
set -uo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
VENV="$ROOT/crawler/.venv"
PY="$VENV/bin/python"

bold() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
warn() { printf '\033[33m   WARN: %s\033[0m\n' "$1"; }
die()  { printf '\033[31m   FATAL: %s\033[0m\n' "$1"; exit 1; }

# A hard step aborts the build on failure; a soft step only warns.
hard() { bold "$1"; shift; "$@" || die "step failed: $*"; }
soft() { bold "$1"; shift; "$@" || warn "step failed (continuing): $*"; }

# --- 0. Prerequisites -------------------------------------------------------
bold "Checking prerequisites"
[ -f "$ROOT/.env" ] || die ".env not found — copy .env.example and fill DATABASE_URL"
grep -q '^DATABASE_URL=' "$ROOT/.env" || die "DATABASE_URL missing in .env"
command -v pnpm >/dev/null || die "pnpm not found"
command -v python3 >/dev/null || die "python3 not found"
grep -q '^FOOTBALL_DATA_TOKEN=' "$ROOT/.env" || warn "FOOTBALL_DATA_TOKEN missing — squads step will be skipped"
[ -d node_modules ] || soft "Install Node deps" pnpm install --frozen-lockfile

# Light Python venv for the crawlers (ranking + news). NO crawl4ai/chromium.
bold "Ensuring Python venv (light deps only)"
{ [ -x "$PY" ] || python3 -m venv "$VENV"; } \
  && "$VENV/bin/pip" install -q --upgrade pip \
  && "$VENV/bin/pip" install -q -r "$ROOT/crawler/requirements-core.txt" \
  || warn "venv setup failed — crawler steps (ranking/news) will be skipped"

# --- 1. Foundation (fail hard) ---------------------------------------------
hard "Applying migrations"            pnpm migrate
hard "Seeding core + venues + FIFA broadcasts/source_ids" pnpm seed

# --- 2. Enrichment (fail soft) ---------------------------------------------
soft "i18n names (REST Countries)"    pnpm seed:i18n
soft "Content (wc26-mcp)"             pnpm seed:content
soft "Full squads + logos + coaches (football-data)" pnpm seed:squads
soft "FIFA-first squad numbers + positions (official squads)" pnpm enrich:squads:fifa
soft "FIFA enrichment (standings/leaders)" pnpm sync:fifa

if [ -x "$PY" ]; then
  soft "FIFA world ranking"           "$PY" "$ROOT/crawler/ranking.py"
  soft "News (RSS)"                    "$PY" "$ROOT/crawler/news.py"

  # crawl4ai stage (player clubs + stadium images). Heavy (chromium) but the
  # data is high-value; whole stage is fail-soft so a fresh server without
  # crawl4ai still gets the full API/RSS dataset.
  if "$PY" -c "import crawl4ai" 2>/dev/null; then
    soft "Player clubs (Wikipedia, crawl4ai)"   "$PY" "$ROOT/crawler/clubs_wiki.py"
    soft "Stadium images (Wikipedia, crawl4ai)" "$PY" "$ROOT/crawler/venue_images.py"
  elif [ "${CRAWL4AI:-0}" = "1" ]; then
    bold "Installing crawl4ai + chromium (CRAWL4AI=1)"
    "$VENV/bin/pip" install -q crawl4ai && "$PY" -m playwright install chromium \
      && soft "Player clubs (Wikipedia, crawl4ai)"   "$PY" "$ROOT/crawler/clubs_wiki.py" \
      && soft "Stadium images (Wikipedia, crawl4ai)" "$PY" "$ROOT/crawler/venue_images.py" \
      || warn "crawl4ai install/run failed — clubs + stadium images skipped"
  else
    warn "crawl4ai not installed — clubs + stadium images skipped (set CRAWL4AI=1 to auto-install, or run 'crawl4ai-setup' once)"
  fi
else
  warn "Python venv unavailable — skipped ranking + news + crawl steps"
fi

# --- 3. Report (source of truth) -------------------------------------------
bold "Verifying dataset"
pnpm dataset:verify
