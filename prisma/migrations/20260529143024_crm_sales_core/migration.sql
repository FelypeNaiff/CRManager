-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SaleAuthorizationType" AS ENUM ('DISCOUNT_OVER_LIMIT', 'CANCEL_SALE');

-- CreateEnum
CREATE TYPE "SaleAuthorizationStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateEnum
CREATE TYPE "SellerCommissionStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExchangeReturnType" AS ENUM ('EXCHANGE', 'RETURN');

-- CreateEnum
CREATE TYPE "ExchangeReturnStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExchangeReturnCondition" AS ENUM ('RESALE', 'DAMAGED', 'DISCARD');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "max_discount_percentage" DECIMAL(5,2) NOT NULL DEFAULT 100.00;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "max_discount_percentage" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "is_seller" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "max_discount_percentage" DECIMAL(5,2),
ADD COLUMN     "pin_last_changed_at" TIMESTAMP(3),
ADD COLUMN     "seller_code" TEXT;

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "seller_id" TEXT NOT NULL,
    "cash_register_id" TEXT,
    "status" "SaleStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(15,2) NOT NULL,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "customer_name_snapshot" TEXT,
    "customer_phone_snapshot" TEXT,
    "cancel_reason" TEXT,
    "cancelled_by_user_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "product_name_snapshot" TEXT NOT NULL,
    "variant_name_snapshot" TEXT NOT NULL,
    "sku_snapshot" TEXT NOT NULL,
    "barcode_snapshot" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "total_price" DECIMAL(15,2) NOT NULL,
    "cost_price_at_sale" DECIMAL(15,2) NOT NULL,
    "sale_price_at_sale" DECIMAL(15,2) NOT NULL,
    "margin_at_sale" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_payments" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "payment_method_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "sale_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_authorizations" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "authorized_by_user_id" TEXT,
    "type" "SaleAuthorizationType" NOT NULL,
    "status" "SaleAuthorizationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_goals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "target_amount" DECIMAL(15,2) NOT NULL,
    "achieved_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT "seller_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_commissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "status" "SellerCommissionStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "seller_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_returns" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "original_sale_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "type" "ExchangeReturnType" NOT NULL,
    "total_credit" DECIMAL(15,2) NOT NULL,
    "status" "ExchangeReturnStatus" NOT NULL DEFAULT 'PENDING',
    "exchange_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_return_items" (
    "id" TEXT NOT NULL,
    "exchange_return_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "condition" "ExchangeReturnCondition" NOT NULL,

    CONSTRAINT "exchange_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_company_id_status_idx" ON "sales"("company_id", "status");

-- CreateIndex
CREATE INDEX "sales_created_at_idx" ON "sales"("created_at");

-- CreateIndex
CREATE INDEX "sales_seller_id_idx" ON "sales"("seller_id");

-- CreateIndex
CREATE INDEX "sales_customer_id_idx" ON "sales"("customer_id");

-- CreateIndex
CREATE INDEX "sale_items_sku_snapshot_idx" ON "sale_items"("sku_snapshot");

-- CreateIndex
CREATE INDEX "sale_items_barcode_snapshot_idx" ON "sale_items"("barcode_snapshot");

-- CreateIndex
CREATE INDEX "seller_goals_user_id_period_start_period_end_idx" ON "seller_goals"("user_id", "period_start", "period_end");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cash_register_id_fkey" FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_authorizations" ADD CONSTRAINT "sale_authorizations_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_authorizations" ADD CONSTRAINT "sale_authorizations_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_authorizations" ADD CONSTRAINT "sale_authorizations_authorized_by_user_id_fkey" FOREIGN KEY ("authorized_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_goals" ADD CONSTRAINT "seller_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_commissions" ADD CONSTRAINT "seller_commissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_commissions" ADD CONSTRAINT "seller_commissions_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_returns" ADD CONSTRAINT "exchange_returns_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_return_items" ADD CONSTRAINT "exchange_return_items_exchange_return_id_fkey" FOREIGN KEY ("exchange_return_id") REFERENCES "exchange_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_return_items" ADD CONSTRAINT "exchange_return_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
