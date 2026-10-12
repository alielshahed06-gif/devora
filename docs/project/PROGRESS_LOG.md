# Progress Log

## 2026-10-10/11 — Stage 1 session (Claude Code, claude-sonnet-5-5)
1. Read prompt; audited `dev-x-book-store-8-2.html` (stripped base64 → 217 KB, read markup + full script).
2. Copied original byte-for-byte to `reference/original-ui/` (+SHA-256).
3. `scripts/extract-reference.mjs` → `reference/extracted/*.json` and 79 images.
4. Tried to reach npm registry: DNS fail direct; via proxy HTTP 403 (org policy). Did not retry/bypass. → no `npm install`, no lockfile, no Next/Prisma/vitest.
5. Wrote `prisma/schema.prisma`; generated SQL migration with a script; applied to local PostgreSQL 16 (port 55432, throw-away cluster, not included in ZIP); added `scripts/verify-migration.sh` (PASS).
6. Ported pricing engine to integer piasters; parity test against the original code (3000 random carts): 2 cases differ by 1 piaster (original float rounding); other fields exact.
7. Wrote Next.js skeleton + configs + `.env.example`; typechecked non-Next files with global `tsc` 6.0.3 (PASS).
8. Wrote docs, manifest, handoff; built ZIP + SHA256SUMS.

## 2026-10-11 — Stage 2 attempt (gate only)
1. Unzipped Stage 1 into a new folder `s2/`; verified ZIP SHA-256 and original HTML byte-identity.
2. Re-checked npm registry: `ENOTFOUND`; `npm install` produced nothing in 60 s. Stopped feature work per gate.
3. Added `scripts/check_schema_vs_db.py`; ran against fresh PG16 DB: 0 discrepancies.
4. Investigated 1-piaster drift: exhaustive scan → float artifact in original; wrote D-014 and `tests/quote.rounding.test.ts` (8/8 tests pass).
5. Updated status/decisions/handoff; produced `DevX_Book_Store_PlanC_Stage_02.zip` (status BLOCKED/PARTIAL).
