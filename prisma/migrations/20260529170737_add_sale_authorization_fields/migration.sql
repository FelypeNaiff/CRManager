/*
  Warnings:

  - Added the required column `allowed_discount` to the `sale_authorizations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requested_discount` to the `sale_authorizations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "sale_authorizations" ADD COLUMN     "allowed_discount" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "requested_discount" DECIMAL(10,2) NOT NULL;
