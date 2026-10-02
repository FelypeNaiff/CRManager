CREATE TYPE "ImportBatchStatus" AS ENUM ('VALIDATING','READY','PROCESSING','COMPLETED','COMPLETED_WITH_ERRORS','FAILED_RECOVERABLE','CANCELLED');
CREATE TYPE "ImportRowStatus" AS ENUM ('READY','IGNORED','BLOCKED','PROCESSING','COMPLETED','FAILED','CONFLICT');
CREATE TYPE "ImportStockPolicy" AS ENUM ('NONE','INITIAL_IF_NO_HISTORY','TARGET_BALANCE','ADDITIONAL_ENTRY');

CREATE TABLE "import_batches" (
  "id" TEXT NOT NULL, "company_id" TEXT NOT NULL, "created_by_user_id" TEXT NOT NULL,
  "content_hash" TEXT NOT NULL, "parser_version" TEXT NOT NULL, "mapping" JSONB NOT NULL,
  "policies" JSONB NOT NULL, "status" "ImportBatchStatus" NOT NULL DEFAULT 'VALIDATING',
  "total_rows" INTEGER NOT NULL DEFAULT 0, "completed_rows" INTEGER NOT NULL DEFAULT 0,
  "error_rows" INTEGER NOT NULL DEFAULT 0, "started_at" TIMESTAMP(3), "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "import_batches_company_id_created_at_idx" ON "import_batches"("company_id", "created_at" DESC);
CREATE INDEX "import_batches_company_id_content_hash_idx" ON "import_batches"("company_id", "content_hash");

CREATE TABLE "import_batch_rows" (
  "id" TEXT NOT NULL, "batch_id" TEXT NOT NULL, "row_number" INTEGER NOT NULL,
  "operation_key" TEXT NOT NULL, "status" "ImportRowStatus" NOT NULL DEFAULT 'READY',
  "proposed_action" TEXT NOT NULL, "source_data" JSONB NOT NULL, "preview_data" JSONB,
  "errors" JSONB, "warnings" JSONB, "product_id" TEXT, "variant_id" TEXT,
  "stock_policy" "ImportStockPolicy" NOT NULL DEFAULT 'NONE', "preview_stock" DECIMAL(10,2),
  "original_quantity" DECIMAL(15,6), "original_unit" TEXT, "conversion_factor" DECIMAL(15,6),
  "processed_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "import_batch_rows_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "import_batch_rows_batch_id_row_number_key" ON "import_batch_rows"("batch_id", "row_number");
CREATE UNIQUE INDEX "import_batch_rows_batch_id_operation_key_key" ON "import_batch_rows"("batch_id", "operation_key");
CREATE INDEX "import_batch_rows_batch_id_status_idx" ON "import_batch_rows"("batch_id", "status");

ALTER TABLE "inventory_movements" ADD COLUMN "import_row_id" TEXT;
CREATE UNIQUE INDEX "inventory_movements_import_row_id_key" ON "inventory_movements"("import_row_id");
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "import_batch_rows" ADD CONSTRAINT "import_batch_rows_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_import_row_id_fkey" FOREIGN KEY ("import_row_id") REFERENCES "import_batch_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
