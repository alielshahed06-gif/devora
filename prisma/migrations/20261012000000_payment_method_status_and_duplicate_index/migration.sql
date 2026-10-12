-- Safe for a fresh database and for environments where these additive changes
-- were previously applied manually. Verify live schema/history before deployment.
ALTER TYPE "PaymentMethodCode" ADD VALUE IF NOT EXISTS 'VODAFONE_CASH';
ALTER TYPE "PaymentMethodCode" ADD VALUE IF NOT EXISTS 'ORANGE_CASH';
ALTER TYPE "PaymentMethodCode" ADD VALUE IF NOT EXISTS 'ETISALAT_CASH';

DO $$
BEGIN
  CREATE TYPE "PaymentConfigStatus" AS ENUM (
    'NOT_CONFIGURED',
    'SANDBOX',
    'AWAITING_APPROVAL',
    'READY',
    'DISABLED',
    'BLOCKED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "PaymentMethodConfig"
  ADD COLUMN IF NOT EXISTS "status" "PaymentConfigStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  ADD COLUMN IF NOT EXISTS "integrationNotes" TEXT NOT NULL DEFAULT '';

UPDATE "PaymentMethodConfig" SET "status" = 'NOT_CONFIGURED' WHERE "status" IS NULL;
UPDATE "PaymentMethodConfig" SET "integrationNotes" = '' WHERE "integrationNotes" IS NULL;

ALTER TABLE "PaymentMethodConfig"
  ALTER COLUMN "status" SET DEFAULT 'NOT_CONFIGURED',
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "integrationNotes" SET DEFAULT '',
  ALTER COLUMN "integrationNotes" SET NOT NULL;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "requestFingerprint" TEXT;

CREATE INDEX IF NOT EXISTS "Order_userId_requestFingerprint_createdAt_idx"
  ON "Order"("userId", "requestFingerprint", "createdAt");
