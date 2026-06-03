/*
  Warnings:

  - You are about to drop the column `max_discount_percentage` on the `roles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "roles" DROP COLUMN "max_discount_percentage",
ADD COLUMN     "default_commission_rate" DECIMAL(5,2),
ADD COLUMN     "default_max_discount_percentage" DECIMAL(5,2),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
