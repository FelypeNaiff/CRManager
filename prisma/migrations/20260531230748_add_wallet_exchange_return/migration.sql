-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('CREDIT', 'DEBIT', 'BONUS', 'ADJUSTMENT', 'REFUND', 'EXCHANGE', 'EXPIRATION');

-- AlterTable
ALTER TABLE "customer_wallets" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "operational_settings" ADD COLUMN     "exchange_require_authorization" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "return_require_authorization" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "wallet_allow_manual_credit" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "wallet_allow_manual_debit" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "wallet_default_refund_method" TEXT NOT NULL DEFAULT 'WALLET';

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "sale_id" TEXT,
    "exchange_id" TEXT,
    "return_id" TEXT,
    "type" "WalletTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balance_before" DECIMAL(12,2) NOT NULL,
    "balance_after" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_exchanges" (
    "id" TEXT NOT NULL,
    "original_sale_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "credit_generated" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "financial_processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_exchanges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_returns" (
    "id" TEXT NOT NULL,
    "original_sale_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "refund_method" TEXT NOT NULL,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "financial_processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_returns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wallet_transactions_customer_id_idx" ON "wallet_transactions"("customer_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_sale_id_idx" ON "wallet_transactions"("sale_id");

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "customer_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
