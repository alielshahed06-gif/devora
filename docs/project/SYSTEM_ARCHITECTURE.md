# System Architecture

**Stack decision (evidence-based):** the supplied material is standalone HTML with no application → new project beside the preserved reference: **Next.js 15 App Router + TypeScript, PostgreSQL + Prisma 6, versioned REST (`/api/v1`) via Route Handlers, server-side validation, cookie-session auth, Node `node:test` + tsx for tests.** See D-001..D-006.

## Module boundaries (intended; only the starred ones exist in Stage 1)
| Layer | Path | Responsibility | Stage 1 |
|---|---|---|---|
| Frontend | `src/app/**` (React Server/Client Components), RTL-first, i18n ar/en | Port of the reference UI; no business rules | skeleton + health page* |
| API | `src/app/api/v1/**/route.ts` | HTTP only: parse → validate (zod, Stage 2) → call service → map errors | health* |
| Business logic | `src/server/<domain>/` (pricing, orders, catalog, coupons, inventory) | Pure/transactional rules; no HTTP | `pricing/quote.ts`* |
| Auth/AuthZ | `src/server/auth/` | Password hashing (argon2id), sessions, roles CUSTOMER/STAFF/ADMIN, CSRF, rate limits | planned |
| Persistence | `prisma/`, `src/server/db.ts` | Prisma client singleton, transactions, repositories | schema + migration* |
| Payment adapters | `src/server/payments/<method>.ts` | Interface `PaymentAdapter` (manual-reference first; gateway later; webhook signature check + idempotency) | planned |
| Logging | `src/server/log.ts` | Structured JSON logs, request id, no PII/secrets | planned |
| Tests | `tests/` | Unit (pricing, validation), DB constraint script, later API/e2e | 5 unit tests* |
| Reference | `reference/` | Original UI (immutable) + extracted seed JSON/assets | done* |

## Key rules carried from the source
* One pricing function is the single source of truth for cart, checkout and order creation: products → sale prices → **tier discount (on total after product discounts)** → **coupon (on eligible lines after tier)** → shipping. Ported to `src/server/pricing/quote.ts` (integer piasters) and verified against the original code.
* Order creation must (in one DB transaction): re-quote server-side, lock variant rows, decrement stock with `CHECK(stock>=0)`, bump coupon `uses` (conditional update), insert order + items snapshot + status history + notification. Never trust client prices.
* Order status and payment status are separate (see `DATABASE_SCHEMA.md`).
* Cancelling restores stock; re-activating re-checks stock (as in the original).

## Security notes (differences from the demo)
Hash passwords; admin is a real `User.role=ADMIN` session, not a client flag; order lookup by number+phone gets rate limiting; no secrets in code (`.env.example` only); payment receiving accounts live in `StoreSetting`, editable by admin.

## Environment constraints found in Stage 1
npm/pip registry egress is blocked in the build sandbox, so dependencies could not be installed and **no lockfile exists**. Stage 2 must run `npm install` somewhere with registry access and commit the lockfile. PostgreSQL 16 was available locally and was used to verify the migration.
