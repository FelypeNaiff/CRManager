-- CreateEnum
CREATE TYPE "AuthorizationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuthorizationType" AS ENUM ('DISCOUNT', 'SALE_CANCEL', 'SALE_REOPEN', 'EXCHANGE', 'EXCHANGE_CANCEL', 'RETURN', 'RETURN_CANCEL', 'WALLET_CREDIT', 'WALLET_DEBIT', 'WALLET_ADJUST', 'CASH_WITHDRAWAL', 'CASH_SUPPLY', 'CASH_DIFFERENCE', 'CASH_REOPEN', 'STOCK_ADJUST', 'NEGATIVE_STOCK', 'USER_PIN_RESET', 'SETTINGS_UPDATE');

-- CreateTable
CREATE TABLE "action_authorizations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type" "AuthorizationType" NOT NULL,
    "module" TEXT NOT NULL,
    "status" "AuthorizationStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by_user_id" TEXT NOT NULL,
    "authorized_by_user_id" TEXT,
    "rejected_by_user_id" TEXT,
    "authorizer_role_id" TEXT,
    "authorizer_role_name" TEXT,
    "reference_id" TEXT,
    "reference_module" TEXT,
    "amount" DECIMAL(12,2),
    "percentage" DECIMAL(12,2),
    "approved_amount" DECIMAL(12,2),
    "approved_percentage" DECIMAL(12,2),
    "reason" TEXT,
    "rejection_reason" TEXT,
    "metadata" JSONB,
    "financial_impact" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorized_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_authorizations_pkey" PRIMARY KEY ("id")
);
