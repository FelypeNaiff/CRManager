-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_seller_id_fkey";

-- DropForeignKey
ALTER TABLE "seller_commissions" DROP CONSTRAINT "seller_commissions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "seller_goals" DROP CONSTRAINT "seller_goals_user_id_fkey";

-- DropIndex
DROP INDEX "seller_goals_user_id_period_start_period_end_idx";

-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "discount_type" TEXT,
ADD COLUMN     "discount_value" DECIMAL(15,2);

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "global_discount_type" TEXT,
ADD COLUMN     "global_discount_value" DECIMAL(15,2);

-- AlterTable
ALTER TABLE "seller_commissions" DROP COLUMN "user_id",
ADD COLUMN     "seller_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "seller_goals" DROP COLUMN "user_id",
ADD COLUMN     "seller_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "commission_rate",
DROP COLUMN "is_seller",
DROP COLUMN "seller_code";

-- CreateTable
CREATE TABLE "sellers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "phone" TEXT,
    "cpf" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "goal" DECIMAL(15,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seller_goals_seller_id_period_start_period_end_idx" ON "seller_goals"("seller_id", "period_start", "period_end");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_goals" ADD CONSTRAINT "seller_goals_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_commissions" ADD CONSTRAINT "seller_commissions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

