import fs from 'fs';
import path from 'path';

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// 1. Create Seller Model
const sellerModel = `
model Seller {
  id             String             @id @default(uuid())
  companyId      String             @map("company_id")
  name           String
  nickname       String?
  phone          String?
  cpf            String?
  email          String?
  status         String             @default("ACTIVE")
  commissionRate Decimal            @default(0.00) @map("commission_rate") @db.Decimal(5, 2)
  goal           Decimal?           @db.Decimal(15, 2)
  notes          String?
  createdAt      DateTime           @default(now()) @map("created_at")
  updatedAt      DateTime           @updatedAt @map("updated_at")

  company        Company            @relation(fields: [companyId], references: [id])
  sales          Sale[]             @relation("SaleSeller")
  goals          SellerGoal[]
  commissions    SellerCommission[]

  @@map("sellers")
}
`;

if (!schema.includes('model Seller {')) {
  schema += '\n' + sellerModel;
}

// 2. Remove seller fields from User
const userModelRegex = /model User \{[\s\S]*?\@\@map\("users"\)\s*\}/;
let userModel = schema.match(userModelRegex)?.[0];

if (userModel) {
  userModel = userModel.replace(/isSeller[^\n]+\n/g, '');
  userModel = userModel.replace(/sellerCode[^\n]+\n/g, '');
  userModel = userModel.replace(/commissionRate[^\n]+\n/g, '');
  userModel = userModel.replace(/sellerGoals[^\n]+\n/g, '');
  userModel = userModel.replace(/sellerCommissions[^\n]+\n/g, '');
  userModel = userModel.replace(/sales\s+Sale\[\]\s+\@relation\("SaleSeller"\)\n?/g, '');
  schema = schema.replace(userModelRegex, userModel);
}

// 3. Update Sale model to point to Seller, and add globalDiscountType/Value
const saleModelRegex = /model Sale \{[\s\S]*?\@\@map\("sales"\)\s*\}/;
let saleModel = schema.match(saleModelRegex)?.[0];
if (saleModel) {
  // Replace relation to Seller
  saleModel = saleModel.replace(/seller\s+User\s+\@relation\("SaleSeller", fields: \[sellerId\], references: \[id\]\)/, 'seller         Seller        @relation("SaleSeller", fields: [sellerId], references: [id])');
  
  // Add discount type fields if not exists
  if (!saleModel.includes('globalDiscountType')) {
    const replacement = `
    subtotal           Decimal    @db.Decimal(15, 2)
    globalDiscountType String?    @map("global_discount_type")
    globalDiscountValue Decimal?  @map("global_discount_value") @db.Decimal(15, 2)
    discountAmount     Decimal    @default(0.00) @map("discount_amount") @db.Decimal(15, 2)
    totalAmount        Decimal    @db.Decimal(15, 2)
    `.trim();
    saleModel = saleModel.replace(/subtotal\s+Decimal\s+\@db\.Decimal\(15, 2\)\s*discountAmount\s+Decimal\s+\@default\(0\.00\)\s+\@map\("discount_amount"\)\s+\@db\.Decimal\(15, 2\)\s*totalAmount\s+Decimal\s+\@db\.Decimal\(15, 2\)/, replacement);
  }
  
  schema = schema.replace(saleModelRegex, saleModel);
}

// 4. Update SaleItem model
const saleItemRegex = /model SaleItem \{[\s\S]*?\@\@map\("sale_items"\)\s*\}/;
let saleItem = schema.match(saleItemRegex)?.[0];
if (saleItem) {
  if (!saleItem.includes('discountType')) {
    const replacement = `
    unitPrice     Decimal @map("unit_price") @db.Decimal(15, 2)
    discountType  String? @map("discount_type")
    discountValue Decimal? @map("discount_value") @db.Decimal(15, 2)
    discount      Decimal @default(0.00) @db.Decimal(15, 2)
    totalPrice    Decimal @map("total_price") @db.Decimal(15, 2)
    `.trim();
    saleItem = saleItem.replace(/unitPrice\s+Decimal\s+\@map\("unit_price"\)\s+\@db\.Decimal\(15, 2\)\s*discount\s+Decimal\s+\@default\(0\.00\)\s+\@db\.Decimal\(15, 2\)\s*totalPrice\s+Decimal\s+\@map\("total_price"\)\s+\@db\.Decimal\(15, 2\)/, replacement);
    schema = schema.replace(saleItemRegex, saleItem);
  }
}

// 5. Update SellerGoal & SellerCommission
const goalRegex = /model SellerGoal \{[\s\S]*?\@\@map\("seller_goals"\)\s*\}/;
let goalModel = schema.match(goalRegex)?.[0];
if (goalModel) {
  goalModel = goalModel.replace(/userId\s+String\s+\@map\("user_id"\)/, 'sellerId       String   @map("seller_id")');
  goalModel = goalModel.replace(/user User \@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/, 'seller Seller @relation(fields: [sellerId], references: [id], onDelete: Cascade)');
  goalModel = goalModel.replace(/\@\@index\(\[userId, periodStart, periodEnd\]\)/, '@@index([sellerId, periodStart, periodEnd])');
  schema = schema.replace(goalRegex, goalModel);
}

const commRegex = /model SellerCommission \{[\s\S]*?\@\@map\("seller_commissions"\)\s*\}/;
let commModel = schema.match(commRegex)?.[0];
if (commModel) {
  commModel = commModel.replace(/userId String                 \@map\("user_id"\)/, 'sellerId String                 @map("seller_id")');
  commModel = commModel.replace(/user User \@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/, 'seller Seller @relation(fields: [sellerId], references: [id], onDelete: Cascade)');
  schema = schema.replace(commRegex, commModel);
}

// 6. Update Company
const companyRegex = /model Company \{[\s\S]*?\@\@map\("companies"\)\s*\}/;
let companyModel = schema.match(companyRegex)?.[0];
if (companyModel && !companyModel.includes('sellers        Seller[]')) {
  companyModel = companyModel.replace(/users                        User\[\]\n/, 'users                        User[]\n    sellers                      Seller[]\n');
  schema = schema.replace(companyRegex, companyModel);
}

fs.writeFileSync(schemaPath, schema, 'utf8');
console.log('Schema updated successfully');
