-- AddColumns
ALTER TABLE "activity_logs"
  ADD COLUMN "authenticated_user_id" TEXT,
  ADD COLUMN "metadata" JSONB;

-- Historical rows cannot distinguish the original authenticated User from the actor.
-- Preserve the best information available without inventing an identity.
UPDATE "activity_logs"
SET "authenticated_user_id" = "user_id"
WHERE "authenticated_user_id" IS NULL;

-- Existing user_id is required and protected by its FK, so every historical row
-- now has a valid authenticated_user_id before enforcing the invariant.
ALTER TABLE "activity_logs"
  ALTER COLUMN "authenticated_user_id" SET NOT NULL;

-- AddForeignKey (same default RESTRICT/NO ACTION behavior as the existing user_id FK)
ALTER TABLE "activity_logs"
  ADD CONSTRAINT "activity_logs_authenticated_user_id_fkey"
  FOREIGN KEY ("authenticated_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex: company_id + created_at already exists and is intentionally reused.
CREATE INDEX "activity_logs_company_id_user_id_created_at_idx"
  ON "activity_logs"("company_id", "user_id", "created_at");

CREATE INDEX "activity_logs_company_id_authenticated_user_id_created_at_idx"
  ON "activity_logs"("company_id", "authenticated_user_id", "created_at");
