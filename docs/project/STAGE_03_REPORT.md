# Stage 3 report — server features and full local verification

## Latest local verification
| Check | Result |
|---|---|
| `npm ci` | **PASS** — installed from `package-lock.json` |
| `npm run lint` | **PASS** — ESLint flat config, no warnings/errors |
| `npm run typecheck` | **PASS** — full app, API, and tests |
| `npm test` | **PASS** — 38/38 tests |
| `npm run test:integration` | **PASS** — 1 real PostgreSQL integration test, 0 skipped, on a dedicated isolated PostgreSQL 18.4 test cluster |
| `npm run db:validate` | **PASS** |
| `prisma migrate deploy` / `migrate status` | **PASS** — all four migrations applied and up to date on the isolated development and test databases |
| `prisma migrate diff --from-migrations ... --to-schema-datamodel ...` | **PASS** — empty diff |
| `npm run build` | **PASS** — optimized Next.js 16.4.0 production build |
| `npm audit --omit=dev` | **PASS** — zero known production dependency vulnerabilities |
| Full `npm audit` | **5 HIGH, development-only** — `braces` through `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch`; dry-run found no compatible fix and proposes a major downgrade of the Next ESLint config. No downgrade was applied. |
| Production database, catalog import, payment provider, deployment | **NOT RUN** — no approved production database/merchant credentials; the local development/test/shadow databases are isolated from production |

Next.js was upgraded to 16.4.0 to address the critical production advisory found in the previous pinned release. Prisma CLI and client were aligned to 6.12.0, the unaffected release indicated by the advisory metadata, and the schema was regenerated and validated. These versions are pinned in `package.json` and `package-lock.json`.

The production-server browser smoke test exercised a real DB-backed product detail, adding an item to the cart, and the cart at desktop/mobile widths. It verified the server quote and totals, registered/logged in a test customer, placed a COD order, and confirmed it appeared in the admin dashboard. The order was moved to `PREPARING` and the updated state was visible in the admin list; the unpaid payment state remained `AWAITING_PAYMENT`.

Order retry handling now fingerprints the full checkout identity with SHA-256, persists that fingerprint with the order, and serializes matching submissions with a signed 64-bit PostgreSQL transaction advisory lock. It returns the original order total even if prices change before a retry. Unit regression coverage includes retries with split/merged cart lines and time-window boundaries. The guarded PostgreSQL integration suite ran against a dedicated local test database and verified concurrent requests, stock races, coupon limits, and transaction rollback.

The public home/category/search/product pages use database-backed active catalog data, including category descriptions and images, when `CATALOG_SOURCE=database` or in production with `auto`. Local demo catalog mode is clearly marked, rejected in production, and prevents checkout. Cart pricing uses the server quote API outside demo mode. Real database-backed checkout/admin API flows were exercised against disposable local data; live catalog import remains an owner/staging task.

## Audit fixes
- COD orders are marked paid when the admin records delivery.
- Paid orders cannot be cancelled until a refund workflow exists; orders with submitted transfers cannot be cancelled until review is resolved.
- Payment submission and review now use conditional transactional state changes to block duplicate submissions, stale acceptance, and payment-status races.
- Admin list/save errors are presented as errors, not as empty data or successful saves. Checkout now surfaces payment/branch fetch failures and blocks pickup checkout without a branch.
- Admin product editing now validates and saves product metadata and category, existing variant size/color/stock, and new variants transactionally; new products remain drafts until published.
- Replaced direct image tags with optimized local Next images, corrected the CSS compatibility warning, migrated linting to Next 16's ESLint flat config, and removed remaining lint/type warnings.
- Cart state now uses a hydration-safe external-store subscription, synchronizes between tabs, and reports local-storage persistence failures without losing the current session's cart.

## Verification status (what actually ran)
| Check | Result |
|---|---|
| `tsx --test tests/*.test.ts` | **38/38 pass** (auth, sessions, navigation role visibility, storefront contact validation, catalog configuration, sanitized errors, rate limit, order creation, duplicate retries, rollback, payment gating, transitions, validators, parity) |
| `npm run test:integration` | **1/1 pass, 0 skipped** — real PostgreSQL/API flow, concurrent checkout, catalog/admin, COD, status transitions, coupon use/rollback, and inventory consistency |
| `npm run typecheck` | **0 errors** — real generated Prisma client and full React/Next app |
| `npm run lint` | **0 errors / warnings** |
| `scripts/import-catalog.ts` dry run | 69/69 valid, no DB contact |
| `npm ci`, `prisma validate/generate`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` | **PASS** — see current results above |
| Production/hosted DB access / write / migration / import / deployment | **None performed** |

## Prisma sync (verified on isolated test database only)
`prisma/schema.prisma` now has `PaymentMethodCode` + `VODAFONE_CASH, ORANGE_CASH, ETISALAT_CASH`, enum `PaymentConfigStatus` (6 verified values), and `PaymentMethodConfig.status` / `integrationNotes`.
The additive migration `20261012000000_payment_method_status_and_duplicate_index` creates the missing config status, extends wallet enum values, and indexes recent duplicate lookup. Both migrations were applied from scratch to the isolated local test database, and the resulting schema matches `schema.prisma`. This says nothing about the state of any hosted database. Compare query 1–3 of `scripts/readonly-db-checks.sql` with the actual target and verify `_prisma_migrations` before deployment; live defaults and migration history must be owner-approved.

`npm run test:integration` runs PostgreSQL checks only when `TEST_DATABASE_URL` points to a localhost database whose name includes `test`. It passed against the dedicated database in this environment. It is not a substitute for checking migration drift on the deployment database.

## API (all under `/api/v1`, JSON `{ok, ...}` / `{ok:false,error:{code,message}}`)
| Method & path | Auth | Notes |
|---|---|---|
| GET `/health` | – | liveness |
| GET `/products?page&pageSize&category&q&sort&offers&available` | – | paginated (max 48), active only, safe fields |
| GET `/products/:id` | – | by id or legacyId |
| GET `/categories`, `/branches`, `/payment-methods` | – | payment methods: only COD (enabled) and online methods with status READY |
| POST `/cart/quote` | – | server prices; no client totals accepted |
| POST `/auth/register` `/auth/login` `/auth/logout`, GET `/auth/me` | – | scrypt hashes, HMAC-signed HttpOnly SameSite=Lax cookie, rate limited; role always CUSTOMER on register, read from DB per request |
| POST/GET `/orders`, GET `/orders/:id`, POST `/orders/:id/payment` | user | ownership in query (no IDOR); one transaction: server quote → conditional stock decrement → coupon consume → order + snapshot + history; always `AWAITING_PAYMENT`; a reference only moves it to `PENDING_REVIEW` |
| GET `/admin/orders`, GET/PATCH `/admin/orders/:id` | STAFF/ADMIN | explicit transition table; prepaid orders cannot be prepared before PAID; cancel restores stock; audit log |
| PATCH `/admin/payments/:id` | ADMIN | only path that sets PAID (amount must match) |
| GET/POST `/admin/products`, PATCH `/admin/products/:id`, GET/POST/PATCH `/admin/categories`, PATCH `/admin/settings` | ADMIN | new products are always inactive; unpublished categories and their products are hidden publicly |
| GET `/admin/payment-methods`, PATCH `/admin/payment-methods/:code` | ADMIN | READY for non-COD requires documented notes |

## Pages added
`/login /register /account /checkout /orders /orders/[id] /admin /product/[id] /category/[id] /policy/[key] /branches /payments /support` (the last three were empty folders — links from the home page 404'd before). Branches use the public pickup-enabled branch API; payment information reflects the server's currently selectable methods; support displays only configured, validated contact links. The public catalog switches between active DB data and an explicitly marked development demo mode; live catalog import remains owner/staging work.

## Known limits / open items
- **Not done:** Arabic/English toggle (UI is Arabic-RTL only), e-book entitlements + protected downloads (needs new tables → migration), wishlist/reviews/support-ticket/password-recovery UIs, governorate/delivery-area tables, real gateway adapters (Fawry/InstaPay/wallets) and webhooks — require merchant credentials/official docs; online methods remain unselectable until a verified integration is implemented.
- Sessions are stateless (no Session table exists): logout clears the cookie; password change invalidates old sessions; rate limiter is in-memory per instance (use Redis for multi-instance).
- Fixed `SESSION_SECRET` (>=32 chars) is required or auth endpoints fail closed.
- Admin bootstrap: `scripts/create-admin.ts` (dry-run default; `--apply` writes ONE user). Catalog import: `scripts/import-catalog.ts` (dry-run default; `--apply` imports inactive, stock 0). Neither has been run.
- Existing 1–2 piaster rounding drift vs original UI (documented D-014) unchanged.
