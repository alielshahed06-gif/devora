# Dev-X Book Store — Plan C

Full-stack rebuild (Next.js 16.4.0 + TypeScript + Prisma 6.12.0/PostgreSQL) of the single-file store UI preserved in `reference/original-ui/`.
**Current local validation baseline:** unit/integration tests, production build, lint, type checks, and Prisma validation pass; see `docs/project/IMPLEMENTATION_STATUS.md` and `docs/project/STAGE_03_REPORT.md` for verification details and launch blockers.

## Layout
`reference/` original UI + extracted seed/assets (read-only) · `prisma/` schema + migrations · `src/` app (`app/`, `lib/`, `server/`) · `tests/` · `scripts/` · `docs/project/` all project docs.

## Commands
| Task | Command | Needs |
|---|---|---|
| Install | `npm ci` | npm registry + `package-lock.json` |
| Dev / build / start | `npm run dev` · `npm run build` · `npm start` | install + `.env` |
| Typecheck / lint / security | `npm run typecheck` · `npm run lint` · `npm audit --omit=dev` | install |
| Tests | `npm test` (= `tsx --test tests/*.test.ts`) | `tsx`, Node ≥ 20 |
| PostgreSQL integration tests | `npm run test:integration` | Dedicated local test DB with the current migrations applied |
| Prepare local databases | `powershell -ExecutionPolicy Bypass -File scripts\dev-setup.ps1` | Local PostgreSQL 18 tools |
| Start local app/database | `powershell -ExecutionPolicy Bypass -File scripts\dev-start.ps1` | `dev-setup.ps1` completed |
| Stop local database | `powershell -ExecutionPolicy Bypass -File scripts\dev-db-stop.ps1` | Local setup |
| Re-extract reference data | `npm run extract:reference` | Node only |
| DB | `npm run db:validate` · `db:generate` · `db:migrate:dev` · `db:migrate:deploy` | Prisma + PostgreSQL |
| Verify SQL migration | `PSQL_URL=postgresql://USER@HOST:PORT npm run db:verify` | psql + server |

Copy `.env.example` → `.env` (never commit it). `npm run db:validate` needs `DATABASE_URL` and `DIRECT_URL`; validating the schema does not apply or reconcile a migration.

### Persistent Windows development environment

For an isolated local setup, run `powershell -ExecutionPolicy Bypass -File scripts\dev-setup.ps1` from the project directory. It creates a private PostgreSQL cluster in ignored `.local\postgres-data`, bound only to `127.0.0.1:55433`, then creates `devx_store_dev`, `devx_store_test`, and `devx_store_shadow`, and applies the repository migrations to the development and test databases. It inserts idempotent fictional sample catalog data/COD config and creates a local administrator only if its configured email is unused. It creates `.env` only when no `.env` exists, generating a random session secret and temporary administrator password without printing them. Existing `.env` values are preserved; the script validates the dev/test targets and adds the dedicated shadow URL only if missing. Read the temporary password locally from the ignored `.env`, then change it at first administrator login. `scripts\dev-start.ps1` starts the cluster and Next development server; `scripts\dev-db-stop.ps1` gracefully stops only this project-owned cluster. Data persists across stop/start cycles. Do not copy this local `.env` or local bootstrap account into deployment.

The floating **دخول الإدارة / خروج الإدارة** control uses the existing server-verified session and role checks. New local bootstrap administrators are forced through password replacement (12+ characters) before any admin API is available. `npm run db:seed:local` and `npm run admin:bootstrap:local` refuse non-loopback databases and production mode.

The theme toggle in the top bar switches between light and dark mode and stores the selection in browser local storage. The initial theme is applied before rendering when browser storage is available.

Public catalog pages use active products, variants, images, categories, and discount tiers from PostgreSQL when `CATALOG_SOURCE=database` (or in production with `auto`). Set `CATALOG_SOURCE=demo` for a clearly marked local preview; demo mode is rejected in production and checkout is disabled. With `auto`, an unconfigured development environment uses that same demo preview so the UI can run without credentials. Product prices and inventory shown in the cart are fetched from the server quote API outside demo mode.

The PostgreSQL integration suite is skipped unless `TEST_DATABASE_URL` is set. It refuses non-local hosts and database names that do not contain `test`, creates uniquely named fixtures, and removes them afterward. Create a dedicated local database first; never point these variables at production or a shared database. The Windows setup script prepares `devx_store_test`, applies the migration chain, and configures the integration runner to use that database. The suite covers concurrent identical submissions, same-total distinct orders, stock races, coupon limits and transaction rollback, login/authorization, database-backed catalog/category/detail/quote APIs, product/category publication and variants, COD checkout, admin order transitions, cancellation stock restoration, and failed-checkout consistency.
