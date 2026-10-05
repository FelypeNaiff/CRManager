-- CreateEnum
CREATE TYPE "EmployeeAdvanceType" AS ENUM ('CASH_ADVANCE', 'PIX_ADVANCE', 'STORE_PRODUCT_WITHDRAWAL');

-- CreateEnum
CREATE TYPE "EmployeeAdvanceStatus" AS ENUM ('PENDING', 'DEDUCTED_PAYROLL', 'CANCELLED');

-- CreateTable
CREATE TABLE "employee_advances" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "competence_month" TEXT NOT NULL,
    "type" "EmployeeAdvanceType" NOT NULL,
    "status" "EmployeeAdvanceStatus" NOT NULL DEFAULT 'PENDING',
    "observation" TEXT,
    "cash_register_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_advances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_advances_company_id_employee_id_idx" ON "employee_advances"("company_id", "employee_id");

-- AddForeignKey
ALTER TABLE "employee_advances" ADD CONSTRAINT "employee_advances_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_advances" ADD CONSTRAINT "employee_advances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_advances" ADD CONSTRAINT "employee_advances_cash_register_id_fkey" FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "inventory_movements_company_id_warehouse_id_variant_id_occurred" RENAME TO "inventory_movements_company_id_warehouse_id_variant_id_occu_idx";
