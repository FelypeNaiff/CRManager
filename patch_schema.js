const fs = require('fs');
const file = 'prisma/schema.prisma';
let code = fs.readFileSync(file, 'utf8');

const model = `
model EmployeeAdvance {
  id              String               @id @default(uuid())
  companyId       String               @map("company_id")
  employeeId      String               @map("employee_id")
  amount          Decimal              @db.Decimal(15, 2)
  date            DateTime             @default(now())
  competenceMonth String               @map("competence_month")
  type            EmployeeAdvanceType
  status          EmployeeAdvanceStatus @default(PENDING)
  observation     String?
  cashRegisterId  String?              @map("cash_register_id")
  createdAt       DateTime             @default(now()) @map("created_at")
  updatedAt       DateTime             @updatedAt @map("updated_at")

  company      Company      @relation(fields: [companyId], references: [id], onDelete: Cascade)
  employee     User         @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  cashRegister CashRegister? @relation(fields: [cashRegisterId], references: [id])

  @@index([companyId, employeeId])
  @@map("employee_advances")
}

enum EmployeeAdvanceType {
  CASH_ADVANCE
  PIX_ADVANCE
  STORE_PRODUCT_WITHDRAWAL
}

enum EmployeeAdvanceStatus {
  PENDING
  DEDUCTED_PAYROLL
  CANCELLED
}
`;

if (!code.includes('EmployeeAdvance')) {
  // Add to User
  code = code.replace(/importBatches\s+ImportBatch\[\]/, 'importBatches               ImportBatch[]\n  employeeAdvances            EmployeeAdvance[]');
  // Add to Company
  code = code.replace(/activityLogs\s+ActivityLog\[\]/, 'activityLogs              ActivityLog[]\n  employeeAdvances            EmployeeAdvance[]');
  // Add to CashRegister
  code = code.replace(/sales\s+Sale\[\]/, 'sales           Sale[]\n  employeeAdvances EmployeeAdvance[]');
  
  code += model;
  fs.writeFileSync(file, code);
  console.log('Appended EmployeeAdvance model to schema');
} else {
  console.log('EmployeeAdvance already exists in schema');
}
