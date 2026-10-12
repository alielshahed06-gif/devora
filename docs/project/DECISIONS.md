# Decisions & Assumptions

| ID | Decision | Evidence / reason | Status |
|---|---|---|---|
| D-001 | New full-stack project in `devx-planc/` beside `reference/` | Source is a single static HTML, no app/stack to extend | Final |
| D-002 | Next.js 15.5.4 (App Router) + React 19.1 + TypeScript | Matches prompt default; avoid Next 16 major jump | Final (versions not yet installed/verified — registry blocked) |
| D-003 | PostgreSQL + Prisma 6.19 (not 7) | Prompt default; avoids unnecessary major upgrade; PG16 present locally | Final |
| D-004 | Money = integer piasters | Original uses float EGP with `r2()`; floats are unsafe for money | Final |
| D-005 | Tests with `node:test` + `tsx` (no vitest/jest yet) | Runs with zero extra deps; could be run in the offline sandbox | Revisit when API tests need a richer runner |
| D-006 | REST `/api/v1`, same logical routes as the original mock (`/api/products`, `/api/quote`, `/api/orders`, …) | Original `realApi` already expects these paths | Final |
| D-007 | Hand-written initial SQL migration | `prisma migrate diff` unavailable offline | **Must be verified in Stage 2** against `schema.prisma` |
| D-008 | Variant uniqueness uses `''` instead of NULL for size/colour | NULLs are distinct in PG unique indexes | Final |
| D-009 | Coupon/tier/shipping/policy/pay-account configuration lives in DB (`Coupon`, `DiscountTier`, `StoreSetting`) | Admin UI edits them in the source | Final |
| D-010 | No `Governorate`, `Survey`, `EbookEntitlement`, `Bundle`, `WebhookEvent`, server `Cart` tables yet | Not present in source UI / no gateway exists; avoid tables for appearance | OPEN — add when requirement confirmed |
| D-011 | Product images stored as files (extracted from base64) referenced by `ProductImage.url` | Embedding 3 MB base64 in DB/HTML is wasteful | Final; storage backend (local vs object) = Stage 2 |
| D-012 | Support phone numbers / Facebook link found in source kept only in `reference/extracted/settings.json`, flagged **unverified** | Source comment says demo data; owner must confirm before publishing | OPEN |
| D-013 | Product data (names, prices, stock=10 each) treated as demo seed | Source comment: "demo… replaced from admin" | Final |

Assumptions: Arabic is the default locale; English is a required addition (not in source). `#102D68` from the prompt is not in the source palette; `--navy-d #031744` is used for hover in source.

## Stage 2 verification gate additions
| ID | Decision | Evidence | Status |
|---|---|---|---|
| D-014 | Rounding rule: all percentages computed with **exact integer math on piasters, `Math.round(amount*rate/100)` (exact halves round up)**; coupon-base uses a single rounding over the eligible sum, as in the original | The 2/3000 parity drifts were investigated: exhaustive scan of 900,000 (amount, 10/15/20 %) cases shows 2,780 (0.31 %) where the original float chain `Math.round(x*100)/100` rounds an exact half-piaster DOWN (e.g. 1.45 EGP × 10 % = 0.145 → 0.14 due to 0.14499999…). It is a float artifact, not a business rule. `tests/quote.rounding.test.ts` pins the behaviour | Final |
| D-015 | The requirements absent from the HTML (English/LTR, Egyptian governorates + configurable delivery areas/fees, e-books with protected downloads, survey/questionnaire APIs, the specified payment methods & integration requirements) **stay in scope/backlog** (supersedes the "deferred/not needed" wording of D-010: absence in the HTML = not implemented yet). No product data, policies, credentials or survey content will be invented; detailed behaviour decided from the owner's design/requirements when those are supplied | Stage 2 prompt, gate Step 5 | Final |
| D-016 | Until `prisma migrate diff` can run, `scripts/check_schema_vs_db.py` is the reconciliation tool (independent parse of `schema.prisma` vs live PG catalog: tables, columns, nullability, types, enums, FKs + delete rules, indexes). It is NOT a replacement | Stage 2 gate | Interim |
