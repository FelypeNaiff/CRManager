-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "needs_phone_review" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone_is_placeholder" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
