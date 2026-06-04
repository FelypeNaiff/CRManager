-- DropIndex
DROP INDEX "product_variants_sku_key";

-- DropIndex
DROP INDEX "sales_created_at_idx";

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "company_id" TEXT;

-- Backfill company_id
UPDATE "product_variants" pv
SET company_id = (SELECT company_id FROM "products" p WHERE p.id = pv.product_id);

-- AlterTable NOT NULL
ALTER TABLE "product_variants" ALTER COLUMN "company_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "inventory_movements_variant_id_created_at_idx" ON "inventory_movements"("variant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "product_variants_company_id_barcode_idx" ON "product_variants"("company_id", "barcode");

-- CreateIndex
CREATE INDEX "product_variants_company_id_product_id_idx" ON "product_variants"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "products_company_id_name_idx" ON "products"("company_id", "name");

-- CreateIndex
CREATE INDEX "products_company_id_internal_code_idx" ON "products"("company_id", "internal_code");

-- CreateIndex
CREATE INDEX "sale_items_variant_id_idx" ON "sale_items"("variant_id");

-- CreateIndex
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items"("sale_id");

-- CreateIndex
CREATE INDEX "sales_company_id_created_at_idx" ON "sales"("company_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add Unique Constraint
CREATE UNIQUE INDEX "product_variants_company_id_sku_key" ON "product_variants"("company_id", "sku");
