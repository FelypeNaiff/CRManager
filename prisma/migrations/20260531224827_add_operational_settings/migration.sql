-- CreateTable
CREATE TABLE "operational_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "allow_discount" BOOLEAN NOT NULL DEFAULT true,
    "seller_discount_limit" DECIMAL(10,2) NOT NULL DEFAULT 5.00,
    "manager_discount_limit" DECIMAL(10,2) NOT NULL DEFAULT 10.00,
    "admin_discount_limit" DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    "require_authorization_above_limit" BOOLEAN NOT NULL DEFAULT true,
    "require_open_cash_register" BOOLEAN NOT NULL DEFAULT true,
    "require_close_cash_register" BOOLEAN NOT NULL DEFAULT true,
    "allow_cash_withdrawal" BOOLEAN NOT NULL DEFAULT true,
    "allow_cash_supply" BOOLEAN NOT NULL DEFAULT true,
    "allow_sale_without_customer" BOOLEAN NOT NULL DEFAULT true,
    "require_customer_on_sale" BOOLEAN NOT NULL DEFAULT false,
    "allow_negative_stock" BOOLEAN NOT NULL DEFAULT false,
    "reserve_stock_on_draft_sale" BOOLEAN NOT NULL DEFAULT false,
    "allow_sale_cancellation" BOOLEAN NOT NULL DEFAULT true,
    "require_authorization_to_cancel_sale" BOOLEAN NOT NULL DEFAULT true,
    "cancellation_time_limit" INTEGER NOT NULL DEFAULT 30,
    "auto_print_receipt" BOOLEAN NOT NULL DEFAULT false,
    "enable_thermal_printer" BOOLEAN NOT NULL DEFAULT false,
    "receipt_model" TEXT NOT NULL DEFAULT 'simples',
    "default_pix_key" TEXT,
    "max_installments" INTEGER NOT NULL DEFAULT 1,
    "default_interest_rate" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "enable_commissions" BOOLEAN NOT NULL DEFAULT true,
    "default_commission_rate" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "enable_seller_goals" BOOLEAN NOT NULL DEFAULT true,
    "enable_customer_wallet" BOOLEAN NOT NULL DEFAULT true,
    "wallet_expiration_days" INTEGER,
    "allow_partial_wallet_usage" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operational_settings_company_id_key" ON "operational_settings"("company_id");

-- CreateIndex
CREATE INDEX "operational_settings_company_id_idx" ON "operational_settings"("company_id");

-- AddForeignKey
ALTER TABLE "operational_settings" ADD CONSTRAINT "operational_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
