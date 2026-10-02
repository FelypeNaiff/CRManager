CREATE TYPE "SaleChannel" AS ENUM ('LEGACY', 'PRODUCT', 'COUNTER', 'QUOTE');

ALTER TABLE "sales"
  ADD COLUMN "channel" "SaleChannel" NOT NULL DEFAULT 'LEGACY';

ALTER TABLE "sales"
  ADD COLUMN "freight_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN "delivery_type" TEXT,
  ADD COLUMN "delivery_address" JSONB,
  ADD COLUMN "delivery_date" TIMESTAMP(3);

CREATE INDEX "sales_company_id_channel_created_at_idx"
  ON "sales"("company_id", "channel", "created_at" DESC);
