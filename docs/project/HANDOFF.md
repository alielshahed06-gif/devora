# HANDOFF (state at end of Stage 2 attempt — BLOCKED at verification gate)

> Stage 2 added only: rounding decision D-014 + test, `scripts/check_schema_vs_db.py` (schema↔DB reconciliation PASS), docs. **No feature work happened because `npm install` is impossible in the sandbox (`ENOTFOUND registry.npmjs.org`).** Everything below from Stage 1 still applies. Tests now: 8/8.

## Required environment variable NAMES
`DATABASE_URL`, `SHADOW_DATABASE_URL`, `SESSION_SECRET`, `APP_BASE_URL`, `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FAWRY_MERCHANT_CODE`, `FAWRY_SECURITY_KEY` (values never in the repo).

## Migration status
`20261010000000_init` — applied to fresh local PG16 OK; reconciled with `schema.prisma` by the interim script; `prisma migrate diff` NOT RUN.

**Open the ZIP root `devx-planc/`.** Start with `README.md`, then this file, then `NEXT_SESSION_PROMPT.md` (copy-ready Prompt 2).

## What exists and works (verified)
* `reference/original-ui/dev-x-book-store-8-2.html` — untouched original (SHA in `ORIGINAL_SHA256.txt`). Open in a browser to see the target UI (demo data lives in your browser localStorage).
* `reference/extracted/*.json` + `reference/original-ui/extracted-assets/**` — seed data & images (regenerate: `node scripts/extract-reference.mjs`, needs only Node ≥ 20).
* `src/server/pricing/quote.ts` + `tests/*.test.ts` — run `npx tsx --test tests/*.test.ts` (needs only `tsx`; Node's built-in runner). Result at hand-off: 5/5 pass.
* `prisma/migrations/20261010000000_init/migration.sql` — verified on PostgreSQL 16 with `PSQL_URL=postgresql://USER@HOST:PORT bash scripts/verify-migration.sh`.

## What does NOT work / was never run
* `npm install`/`npm ci`, `prisma validate|generate`, `next build|dev`, `next lint` — **never run** (registry blocked in the Stage 1 sandbox). `package.json` versions are pinned from knowledge, **not verified to exist** — if a version is missing, pick the nearest published one and note it in `DECISIONS.md`.
* No lockfile. Commit `package-lock.json` as soon as install succeeds.
* `schema.prisma` ↔ `migration.sql` equivalence unverified (hand-made SQL).

## Known defects / risks
* No English/LTR, governorates, e-books, surveys in source (see `PROJECT_BRIEF.md`) — owner confirmation needed (D-010).
* Support phone numbers in extracted settings are from the source and unverified (D-012).
* Original demo auth is insecure; do not port its logic.

## Exact next steps
1. In an environment with npm access: `cd devx-planc && npm install` → commit lockfile → `npx prisma validate` → `npx prisma generate` → `npm run typecheck` → `npm run build`.
2. `createdb devx_store` ; copy `.env.example` → `.env`; `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_DATABASE_URL" --exit-code` (must be empty; if not, fix schema or add a corrective migration) ; `npx prisma migrate deploy`.
3. Implement seed from `reference/extracted/`, then Stage 2 scope in `NEXT_SESSION_PROMPT.md`.

No Git repo is used; hand-over unit = ZIP (`DevX_Book_Store_PlanC_Stage_01.zip`).
