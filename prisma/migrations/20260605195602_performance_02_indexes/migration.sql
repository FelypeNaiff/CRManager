-- CreateIndex
CREATE INDEX "action_authorizations_company_id_status_type_idx" ON "action_authorizations"("company_id", "status", "type");

-- CreateIndex
CREATE INDEX "action_authorizations_company_id_created_at_idx" ON "action_authorizations"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_company_id_created_at_idx" ON "activity_logs"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_company_id_module_action_idx" ON "activity_logs"("company_id", "module", "action");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_created_at_idx" ON "activity_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "customer_children_customer_id_idx" ON "customer_children"("customer_id");

-- CreateIndex
CREATE INDEX "customer_children_birth_date_idx" ON "customer_children"("birth_date");

-- CreateIndex
CREATE INDEX "customer_histories_customer_id_created_at_idx" ON "customer_histories"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "customer_interactions_customer_id_created_at_idx" ON "customer_interactions"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "customer_wallet_movements_wallet_id_created_at_idx" ON "customer_wallet_movements"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "customer_wallet_movements_wallet_id_type_idx" ON "customer_wallet_movements"("wallet_id", "type");

-- CreateIndex
CREATE INDEX "customers_company_id_status_idx" ON "customers"("company_id", "status");

-- CreateIndex
CREATE INDEX "customers_company_id_name_idx" ON "customers"("company_id", "name");

-- CreateIndex
CREATE INDEX "customers_company_id_created_at_idx" ON "customers"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "exchange_returns_company_id_status_idx" ON "exchange_returns"("company_id", "status");

-- CreateIndex
CREATE INDEX "exchange_returns_company_id_created_at_idx" ON "exchange_returns"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "exchange_returns_customer_id_idx" ON "exchange_returns"("customer_id");

-- CreateIndex
CREATE INDEX "product_price_histories_product_id_changed_at_idx" ON "product_price_histories"("product_id", "changed_at");

-- CreateIndex
CREATE INDEX "sale_authorizations_sale_id_idx" ON "sale_authorizations"("sale_id");

-- CreateIndex
CREATE INDEX "sale_authorizations_status_idx" ON "sale_authorizations"("status");

-- CreateIndex
CREATE INDEX "sale_authorizations_type_idx" ON "sale_authorizations"("type");

-- CreateIndex
CREATE INDEX "sale_payments_sale_id_idx" ON "sale_payments"("sale_id");

-- CreateIndex
CREATE INDEX "sale_payments_payment_method_id_idx" ON "sale_payments"("payment_method_id");

-- CreateIndex
CREATE INDEX "sale_payments_status_idx" ON "sale_payments"("status");

-- CreateIndex
CREATE INDEX "seller_commissions_seller_id_status_idx" ON "seller_commissions"("seller_id", "status");

-- CreateIndex
CREATE INDEX "seller_commissions_sale_id_idx" ON "seller_commissions"("sale_id");

-- CreateIndex
CREATE INDEX "sellers_company_id_status_idx" ON "sellers"("company_id", "status");

-- CreateIndex
CREATE INDEX "sellers_company_id_name_idx" ON "sellers"("company_id", "name");

-- CreateIndex
CREATE INDEX "users_company_id_status_idx" ON "users"("company_id", "status");

-- CreateIndex
CREATE INDEX "users_company_id_name_idx" ON "users"("company_id", "name");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_created_at_idx" ON "wallet_transactions"("wallet_id", "created_at");
