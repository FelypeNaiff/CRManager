CREATE TABLE "warehouses" (
  "id" TEXT NOT NULL, "company_id" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false, "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "warehouses_company_id_code_key" ON "warehouses"("company_id", "code");
CREATE INDEX "warehouses_company_id_is_active_idx" ON "warehouses"("company_id", "is_active");
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "warehouses" ("id", "company_id", "code", "name", "is_default", "is_active", "updated_at")
SELECT substr(md5("id" || ':LOJA_PRINCIPAL'),1,8)||'-'||substr(md5("id" || ':LOJA_PRINCIPAL'),9,4)||'-'||substr(md5("id" || ':LOJA_PRINCIPAL'),13,4)||'-'||substr(md5("id" || ':LOJA_PRINCIPAL'),17,4)||'-'||substr(md5("id" || ':LOJA_PRINCIPAL'),21,12),
       "id", 'LOJA_PRINCIPAL', 'Loja principal', true, true, CURRENT_TIMESTAMP
FROM "companies";

CREATE TABLE "stock_positions" (
  "id" TEXT NOT NULL, "company_id" TEXT NOT NULL, "warehouse_id" TEXT NOT NULL, "variant_id" TEXT NOT NULL,
  "physical_stock" DECIMAL(15,2) NOT NULL DEFAULT 0, "reserved_stock" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "stock_positions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "stock_positions_company_id_warehouse_id_variant_id_key" ON "stock_positions"("company_id","warehouse_id","variant_id");
CREATE INDEX "stock_positions_company_id_variant_id_idx" ON "stock_positions"("company_id","variant_id");
ALTER TABLE "stock_positions" ADD CONSTRAINT "stock_positions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_positions" ADD CONSTRAINT "stock_positions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_positions" ADD CONSTRAINT "stock_positions_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "stock_positions" ("id","company_id","warehouse_id","variant_id","physical_stock","reserved_stock","version","updated_at")
SELECT gen_random_uuid()::text, pv."company_id", w."id", pv."id", pv."current_stock", pv."reserved_stock", 0, CURRENT_TIMESTAMP
FROM "product_variants" pv JOIN "warehouses" w ON w."company_id"=pv."company_id" AND w."code"='LOJA_PRINCIPAL';

ALTER TABLE "inventory_movements" ADD COLUMN "company_id" TEXT;
ALTER TABLE "inventory_movements" ADD COLUMN "reserved_quantity" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "inventory_movements" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "inventory_movements" ADD COLUMN "document_type" TEXT;
ALTER TABLE "inventory_movements" ADD COLUMN "document_id" TEXT;
ALTER TABLE "inventory_movements" ADD COLUMN "idempotency_key" TEXT;
ALTER TABLE "inventory_movements" ADD COLUMN "correlation_id" TEXT;
ALTER TABLE "inventory_movements" ADD COLUMN "reversal_of_id" TEXT;
ALTER TABLE "inventory_movements" ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'UN';
ALTER TABLE "inventory_movements" ADD COLUMN "unit_cost" DECIMAL(10,2);
ALTER TABLE "inventory_movements" ADD COLUMN "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "inventory_movements" im SET "company_id"=pv."company_id", "warehouse_id"=w."id", "occurred_at"=im."created_at"
FROM "product_variants" pv JOIN "warehouses" w ON w."company_id"=pv."company_id" AND w."code"='LOJA_PRINCIPAL'
WHERE im."variant_id"=pv."id";
ALTER TABLE "inventory_movements" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "inventory_movements" ALTER COLUMN "warehouse_id" DROP DEFAULT;
CREATE UNIQUE INDEX "inventory_movements_company_id_idempotency_key_key" ON "inventory_movements"("company_id","idempotency_key");
CREATE UNIQUE INDEX "inventory_movements_reversal_of_id_key" ON "inventory_movements"("reversal_of_id");
CREATE INDEX "inventory_movements_company_id_warehouse_id_variant_id_occurred_at_id_idx" ON "inventory_movements"("company_id","warehouse_id","variant_id","occurred_at","id");
CREATE INDEX "inventory_movements_company_id_origin_document_id_idx" ON "inventory_movements"("company_id","origin","document_id");
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "inventory_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "stock_adjustments" (
 "id" TEXT NOT NULL, "company_id" TEXT NOT NULL, "warehouse_id" TEXT NOT NULL, "variant_id" TEXT NOT NULL,
 "kind" TEXT NOT NULL, "requested_quantity" DECIMAL(15,2) NOT NULL, "applied_delta" DECIMAL(15,2) NOT NULL,
 "expected_version" INTEGER, "reason" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'COMPLETED',
 "idempotency_key" TEXT NOT NULL, "reversal_of_id" TEXT, "created_by_user_id" TEXT NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY("id")
);
CREATE UNIQUE INDEX "stock_adjustments_company_id_idempotency_key_key" ON "stock_adjustments"("company_id","idempotency_key");
CREATE UNIQUE INDEX "stock_adjustments_reversal_of_id_key" ON "stock_adjustments"("reversal_of_id");
CREATE INDEX "stock_adjustments_company_id_created_at_idx" ON "stock_adjustments"("company_id","created_at" DESC);
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_company_id_fkey" FOREIGN KEY("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_warehouse_id_fkey" FOREIGN KEY("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_variant_id_fkey" FOREIGN KEY("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_reversal_of_id_fkey" FOREIGN KEY("reversal_of_id") REFERENCES "stock_adjustments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "stock_transfers" (
 "id" TEXT NOT NULL, "company_id" TEXT NOT NULL, "from_warehouse_id" TEXT NOT NULL, "to_warehouse_id" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'COMPLETED', "reason" TEXT, "idempotency_key" TEXT NOT NULL, "reversal_of_id" TEXT,
 "created_by_user_id" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "stock_transfers_pkey" PRIMARY KEY("id")
);
CREATE UNIQUE INDEX "stock_transfers_company_id_idempotency_key_key" ON "stock_transfers"("company_id","idempotency_key");
CREATE UNIQUE INDEX "stock_transfers_reversal_of_id_key" ON "stock_transfers"("reversal_of_id");
CREATE INDEX "stock_transfers_company_id_created_at_idx" ON "stock_transfers"("company_id","created_at" DESC);
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_company_id_fkey" FOREIGN KEY("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_warehouse_id_fkey" FOREIGN KEY("from_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_warehouse_id_fkey" FOREIGN KEY("to_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_reversal_of_id_fkey" FOREIGN KEY("reversal_of_id") REFERENCES "stock_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "stock_transfer_items" ("id" TEXT NOT NULL,"transfer_id" TEXT NOT NULL,"variant_id" TEXT NOT NULL,"quantity" DECIMAL(15,2) NOT NULL,CONSTRAINT "stock_transfer_items_pkey" PRIMARY KEY("id"));
CREATE UNIQUE INDEX "stock_transfer_items_transfer_id_variant_id_key" ON "stock_transfer_items"("transfer_id","variant_id");
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_transfer_id_fkey" FOREIGN KEY("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_variant_id_fkey" FOREIGN KEY("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "inventory_sessions" ("id" TEXT NOT NULL,"company_id" TEXT NOT NULL,"warehouse_id" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'COUNTING',"name" TEXT NOT NULL,"created_by_user_id" TEXT NOT NULL,"approved_by_user_id" TEXT,"started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"approved_at" TIMESTAMP(3),"cancelled_at" TIMESTAMP(3),CONSTRAINT "inventory_sessions_pkey" PRIMARY KEY("id"));
CREATE INDEX "inventory_sessions_company_id_status_started_at_idx" ON "inventory_sessions"("company_id","status","started_at" DESC);
ALTER TABLE "inventory_sessions" ADD CONSTRAINT "inventory_sessions_company_id_fkey" FOREIGN KEY("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_sessions" ADD CONSTRAINT "inventory_sessions_warehouse_id_fkey" FOREIGN KEY("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "inventory_count_items" ("id" TEXT NOT NULL,"session_id" TEXT NOT NULL,"variant_id" TEXT NOT NULL,"reference_physical" DECIMAL(15,2) NOT NULL,"reference_version" INTEGER NOT NULL,"counted_quantity" DECIMAL(15,2),"recount_quantity" DECIMAL(15,2),"applied_movement_id" TEXT,"applied_at" TIMESTAMP(3),CONSTRAINT "inventory_count_items_pkey" PRIMARY KEY("id"));
CREATE UNIQUE INDEX "inventory_count_items_session_id_variant_id_key" ON "inventory_count_items"("session_id","variant_id");
CREATE UNIQUE INDEX "inventory_count_items_applied_movement_id_key" ON "inventory_count_items"("applied_movement_id");
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_session_id_fkey" FOREIGN KEY("session_id") REFERENCES "inventory_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_variant_id_fkey" FOREIGN KEY("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
