ALTER TABLE "product_categories" ADD COLUMN "commission_rate" DECIMAL(5,2);

ALTER TABLE "products"
  ADD COLUMN "sales_unit" TEXT NOT NULL DEFAULT 'UN',
  ADD COLUMN "purchase_unit" TEXT NOT NULL DEFAULT 'UN',
  ADD COLUMN "purchase_factor" DECIMAL(15,6) NOT NULL DEFAULT 1.000000,
  ADD COLUMN "track_stock" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pdv_eligible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "ncm" TEXT,
  ADD COLUMN "cest" TEXT,
  ADD COLUMN "fiscal_origin" TEXT,
  ADD COLUMN "commission_rate" DECIMAL(5,2);

ALTER TABLE "product_variants"
  ADD COLUMN "maximum_stock" DECIMAL(10,2),
  ADD COLUMN "weight_kg" DECIMAL(10,3),
  ADD COLUMN "height_cm" DECIMAL(10,2),
  ADD COLUMN "width_cm" DECIMAL(10,2),
  ADD COLUMN "length_cm" DECIMAL(10,2);

ALTER TABLE "sale_items"
  ADD COLUMN "commission_base_snapshot" DECIMAL(15,2),
  ADD COLUMN "commission_rate_snapshot" DECIMAL(5,2),
  ADD COLUMN "commission_amount_snapshot" DECIMAL(15,2),
  ADD COLUMN "commission_rule_source" TEXT;

CREATE TABLE "product_suppliers" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "supplier_id" TEXT NOT NULL,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "supplier_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_suppliers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_suppliers_product_id_supplier_id_key" ON "product_suppliers"("product_id", "supplier_id");
CREATE INDEX "product_suppliers_company_id_supplier_id_idx" ON "product_suppliers"("company_id", "supplier_id");
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "product_suppliers" ("id", "company_id", "product_id", "supplier_id", "is_primary")
SELECT gen_random_uuid()::text, "company_id", "id", "supplier_id", true FROM "products" WHERE "supplier_id" IS NOT NULL;

CREATE TABLE "price_tables" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "price_tables_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "price_tables_company_id_name_key" ON "price_tables"("company_id", "name");
CREATE INDEX "price_tables_company_id_is_active_idx" ON "price_tables"("company_id", "is_active");
ALTER TABLE "price_tables" ADD CONSTRAINT "price_tables_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "price_table_items" (
  "id" TEXT NOT NULL,
  "price_table_id" TEXT NOT NULL,
  "variant_id" TEXT NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  CONSTRAINT "price_table_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "price_table_items_price_table_id_variant_id_key" ON "price_table_items"("price_table_id", "variant_id");
CREATE INDEX "price_table_items_variant_id_idx" ON "price_table_items"("variant_id");
ALTER TABLE "price_table_items" ADD CONSTRAINT "price_table_items_price_table_id_fkey" FOREIGN KEY ("price_table_id") REFERENCES "price_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "price_table_items" ADD CONSTRAINT "price_table_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
