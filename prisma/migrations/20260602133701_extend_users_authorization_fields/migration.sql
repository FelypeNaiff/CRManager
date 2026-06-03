-- AlterTable
ALTER TABLE "users" ADD COLUMN     "authorization_pin_hash" TEXT,
ADD COLUMN     "pin_reset_required" BOOLEAN NOT NULL DEFAULT false;
