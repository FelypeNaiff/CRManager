-- Additive follow-up: the original Sprint D migration may already exist elsewhere.
ALTER TABLE "import_batches" ADD COLUMN IF NOT EXISTS "fingerprint" TEXT;
UPDATE "import_batches"
SET "fingerprint" = "company_id" || ':' || "id"
WHERE "fingerprint" IS NULL;
ALTER TABLE "import_batches" ALTER COLUMN "fingerprint" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "import_batches_fingerprint_key" ON "import_batches"("fingerprint");

ALTER TABLE "import_batch_rows" ADD COLUMN IF NOT EXISTS "processing_token" TEXT;
ALTER TABLE "import_batch_rows" ADD COLUMN IF NOT EXISTS "lease_expires_at" TIMESTAMP(3);
ALTER TABLE "import_batch_rows" ADD COLUMN IF NOT EXISTS "attempt_count" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "import_batch_rows_status_lease_expires_at_idx"
  ON "import_batch_rows"("status", "lease_expires_at");
