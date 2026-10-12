-- READ-ONLY reconciliation checks for Supabase (SQL editor or psql). Contains only SELECTs. Run, then share the results (no secrets involved).
-- 1) Migration history (expect only 20261010000000_init unless the payment migration was registered)
SELECT migration_name, checksum, finished_at, rolled_back_at, applied_steps_count, left(coalesce(logs,''), 120) AS logs FROM _prisma_migrations ORDER BY started_at;
-- 2) Enum values (compare with prisma/schema.prisma)
SELECT t.typname, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS labels FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' GROUP BY t.typname ORDER BY t.typname;
-- 3) PaymentMethodConfig exact column definitions (type / nullability / DEFAULT) -> confirms the schema.prisma sync assumptions
SELECT column_name, data_type, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PaymentMethodConfig' ORDER BY ordinal_position;
-- 4) Current payment method rows (names/status only)
SELECT code, enabled, status, sort, length(coalesce("integrationNotes", '')) AS notes_len FROM "PaymentMethodConfig" ORDER BY sort;
-- 5) Tables and row counts
SELECT 'Product' t, count(*) FROM "Product" UNION ALL SELECT 'ProductVariant', count(*) FROM "ProductVariant" UNION ALL SELECT 'Category', count(*) FROM "Category" UNION ALL SELECT '"User"', count(*) FROM "User" UNION ALL SELECT '"Order"', count(*) FROM "Order" UNION ALL SELECT 'Branch', count(*) FROM "Branch" UNION ALL SELECT 'StoreSetting', count(*) FROM "StoreSetting";
-- 6) Constraints/indexes on tables relevant to checkout
SELECT conrelid::regclass AS tbl, conname, contype, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND conrelid::regclass::text IN ('"ProductVariant"', '"Order"', '"PaymentAttempt"', '"Coupon"', '"PaymentMethodConfig"') ORDER BY 1, 2;
-- 7) Any unexpected columns/tables not in the local schema
SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name NOT IN ('_prisma_migrations') ORDER BY table_name, ordinal_position;
