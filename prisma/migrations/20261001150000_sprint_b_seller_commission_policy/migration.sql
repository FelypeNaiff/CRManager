CREATE TYPE "CommissionReleasePolicy" AS ENUM (
  'ON_FINANCIAL_OBLIGATION',
  'ON_FIRST_INSTALLMENT_RECEIVED',
  'ON_FULL_SETTLEMENT',
  'PROPORTIONAL_TO_RECEIPTS'
);

ALTER TABLE "operational_settings"
  ADD COLUMN "commission_release_policy" "CommissionReleasePolicy" NOT NULL DEFAULT 'ON_FINANCIAL_OBLIGATION';

ALTER TABLE "sellers"
  ADD COLUMN "mobile" TEXT,
  ADD COLUMN "rg" TEXT,
  ADD COLUMN "birth_date" TIMESTAMP(3),
  ADD COLUMN "user_id" TEXT,
  ADD COLUMN "cep" TEXT,
  ADD COLUMN "street" TEXT,
  ADD COLUMN "address_number" TEXT,
  ADD COLUMN "complement" TEXT,
  ADD COLUMN "district" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "commission_release_policy" "CommissionReleasePolicy";

ALTER TABLE "seller_commissions"
  ADD COLUMN "base_amount_snapshot" DECIMAL(15,2),
  ADD COLUMN "rate_snapshot" DECIMAL(5,2),
  ADD COLUMN "release_policy_snapshot" "CommissionReleasePolicy",
  ADD COLUMN "released_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "paid_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "released_at" TIMESTAMP(3),
  ADD COLUMN "paid_at" TIMESTAMP(3),
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "sellers_company_id_cpf_key" ON "sellers"("company_id", "cpf");
CREATE UNIQUE INDEX "sellers_user_id_key" ON "sellers"("user_id");
CREATE UNIQUE INDEX "seller_commissions_seller_id_sale_id_key" ON "seller_commissions"("seller_id", "sale_id");
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
