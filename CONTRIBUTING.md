# Contributing

Thanks for your interest in contributing to **worldcup-backend** — the open-source
FIFA World Cup 2026 companion backend. This guide covers everything you need to get
a local environment running and submit changes.

## Prerequisites

- **Node.js 24** (Active LTS). An `.nvmrc` is provided — run `nvm use`.
- **pnpm** (package manager): `npm i -g pnpm`
- **Docker** + Docker Compose (for the local PostgreSQL instance and pre-loaded dataset).

## Setup

```bash
# 1. Start PostgreSQL — the compose setup auto-loads the bundled dataset on first boot
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Copy environment template and adjust if needed
cp .env.example .env

# 4. Run the dev server (Fastify, hot-reload)
pnpm dev
```

The API is then available on `http://localhost:3000` (or your configured `PORT`).

> If the dataset did not auto-load, you can restore the bundled snapshot manually with
> `pnpm db:restore`.

## Rebuilding the data

The dataset is aggregated from several public sources (see `ATTRIBUTION.md`). To rebuild
it from scratch:

```bash
pnpm dataset:build
```

You can verify counts and integrity afterwards with:

```bash
pnpm dataset:verify
```

## Code style

We use ESLint + Prettier. Run the linter (with auto-fix) before committing:

```bash
pnpm lint
```

## Tests

```bash
pnpm test       # unit tests (Jest)
pnpm test:e2e   # end-to-end tests (requires a seeded database)
```

> Note: e2e tests need a running, seeded database, so they are **not** run in CI.
> Please run them locally before opening a PR that touches API behavior.

## Migrations

Schema changes use **Drizzle ORM**. The flow is forward-only and sequential:

```bash
pnpm db:generate   # generate a migration from the schema
pnpm migrate       # apply pending migrations
```

Always review generated SQL before applying it to any shared database.

## Commit & PR guidelines

- Prefer [Conventional Commits](https://www.conventionalcommits.org/)
  (e.g. `feat:`, `fix:`, `docs:`, `chore:`).
- Keep PRs focused; one logical change per PR where possible.
- Run `pnpm lint` and `pnpm test` before opening a PR.
- Describe what changed and why; link related issues.

## A note on data sources

FIFA and other upstream data are used purely as **enrichment** and are governed by the
project's [DISCLAIMER.md](./DISCLAIMER.md) and [ATTRIBUTION.md](./ATTRIBUTION.md). This
project is not affiliated with or endorsed by FIFA. Please respect each source's Terms
of Service when contributing data-related changes.
