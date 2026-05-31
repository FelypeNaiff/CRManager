-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "enable_customer_credit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enable_seller_commission" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enable_seller_goals" BOOLEAN NOT NULL DEFAULT false;
