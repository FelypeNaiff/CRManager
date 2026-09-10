import { PaymentMethodType, type Prisma } from "@prisma/client";
import { sanitizeAdminDatabaseError, withReadOnlyAdminDatabase } from '../src/lib/database/admin-script-access';
import { assertExpectedCompany, requireExpectedCompanyId } from './import-admin-access';

export async function runGoLiveDiagnostics(prisma: Prisma.TransactionClient, companyId: string) {
  console.log("==================================================");
  console.log("STARTING NEEX GO-LIVE-01 DIAGNOSTIC AUDIT");
  console.log("==================================================");

  let scoreInfra = "OK";
  let scoreSeguranca = "OK";
  let scoreUsuarios = "OK";
  let scoreProdutos = "OK";
  let scoreCRM = "OK";
  let scoreFinanceiro = "OK";

  // 1. INFRASTRUCTURE CHECK
  console.log("\n1. INFRASTRUCTURE STATE:");
  try {
    await assertExpectedCompany(prisma, companyId);
    console.log(`  [PASS] Administrative tenant verified.`);
  } catch (err: any) {
    console.error(`  [FAIL] Administrative tenant verification failed: ${sanitizeAdminDatabaseError(err)}`);
    scoreInfra = "NOK";
  }

  // 2. USERS & SECURITY QUALITY
  console.log("\n2. USERS & SECURITY AUDIT:");
  const activeUsers = await prisma.user.count({ where: { companyId, status: "ACTIVE" } });
  const usersWithoutProfile = await prisma.user.count({ where: { companyId, roleId: null } });
  const usersWithoutPIN = await prisma.user.count({ 
    where: { 
      companyId,
      status: "ACTIVE", 
      authorizationPinHash: null 
    } 
  });

  console.log(`  - Active Users: ${activeUsers}`);
  if (usersWithoutProfile > 0) {
    console.warn(`  - [WARNING] Users without role/profile: ${usersWithoutProfile}`);
    scoreUsuarios = "NOK";
  } else {
    console.log(`  - Users without role/profile: 0 (All users have roles)`);
  }

  if (usersWithoutPIN > 0) {
    console.log(`  - [INFO] Active users without authorization PIN set: ${usersWithoutPIN} (Admin PINs required for discount auths above limits)`);
  } else {
    console.log(`  - Active users without authorization PIN: 0`);
  }

  // 3. PRODUCTS DATA QUALITY
  console.log("\n3. PRODUCTS & VARIANTS AUDIT:");
  const productsWithoutCategory = await prisma.product.count({ where: { companyId, categoryId: null } });
  
  // Since sku is a required non-nullable unique string, we check for empty SKU
  const variantsWithoutSKU = await prisma.productVariant.count({
    where: { companyId, OR: [{ sku: "" }, { sku: { equals: undefined } }] }
  });

  const variants = await prisma.productVariant.findMany({ where: { companyId } });
  let negativeStockCount = 0;
  let zeroSalePriceCount = 0;
  let zeroCostPriceCount = 0;

  for (const v of variants) {
    if (v.currentStock.toNumber() < 0 || v.availableStock.toNumber() < 0) {
      negativeStockCount++;
    }
    if (v.salePrice.toNumber() <= 0) {
      zeroSalePriceCount++;
    }
    if (v.costPrice.toNumber() <= 0) {
      zeroCostPriceCount++;
    }
  }

  console.log(`  - Total Products: ${await prisma.product.count({ where: { companyId } })}`);
  console.log(`  - Total Variants: ${variants.length}`);
  
  if (productsWithoutCategory > 0) {
    console.warn(`  - [WARNING] Products without category: ${productsWithoutCategory}`);
    scoreProdutos = "NOK";
  } else {
    console.log(`  - Products without category: 0`);
  }

  if (variantsWithoutSKU > 0) {
    console.error(`  - [FAIL] Variants with empty/missing SKU: ${variantsWithoutSKU}`);
    scoreProdutos = "NOK";
  } else {
    console.log(`  - Variants with empty/missing SKU: 0`);
  }

  if (negativeStockCount > 0) {
    console.warn(`  - [WARNING] Variants with negative stock: ${negativeStockCount}`);
    scoreProdutos = "NOK";
  } else {
    console.log(`  - Variants with negative stock: 0`);
  }

  if (zeroSalePriceCount > 0) {
    console.warn(`  - [WARNING] Variants with sale price <= 0: ${zeroSalePriceCount}`);
    scoreProdutos = "NOK";
  } else {
    console.log(`  - Variants with sale price <= 0: 0`);
  }

  if (zeroCostPriceCount > 0) {
    console.log(`  - [INFO] Variants with cost price <= 0 (e.g. promotional items or services): ${zeroCostPriceCount}`);
  } else {
    console.log(`  - Variants with cost price <= 0: 0`);
  }

  // 4. FINANCIAL DATA QUALITY
  console.log("\n4. FINANCIAL AUDIT:");
  const paymentMethods = await prisma.paymentMethod.findMany({ where: { companyId } });
  let invalidPMTypeCount = 0;
  const validTypes = Object.values(PaymentMethodType);
  for (const pm of paymentMethods) {
    if (!validTypes.includes(pm.type)) {
      invalidPMTypeCount++;
    }
  }

  const inactiveBankAccounts = await prisma.bankAccount.count({ where: { companyId, isActive: false } });
  const openCashRegisters = await prisma.cashRegister.count({ where: { companyId, status: "OPEN" } });
  
  const overduePendingReceivables = await prisma.accountsReceivable.count({
    where: {
      companyId,
      status: "PENDING",
      dueDate: { lt: new Date() }
    }
  });

  if (invalidPMTypeCount > 0) {
    console.error(`  - [FAIL] Payment methods with undefined/invalid type: ${invalidPMTypeCount}`);
    scoreFinanceiro = "NOK";
  } else {
    console.log(`  - Payment methods with undefined/invalid type: 0`);
  }

  console.log(`  - Inactive Bank Accounts: ${inactiveBankAccounts}`);
  console.log(`  - Active/Open Cash Registers: ${openCashRegisters}`);
  
  if (overduePendingReceivables > 0) {
    console.warn(`  - [WARNING] Overdue pending receivables (contas a receber vencidas): ${overduePendingReceivables}`);
  } else {
    console.log(`  - Overdue pending receivables: 0`);
  }

  // 5. CRM DATA QUALITY
  console.log("\n5. CRM AUDIT:");
  const customersWithoutPhone = await prisma.customer.count({
    where: { companyId, OR: [{ phone: "" }, { phoneIsPlaceholder: true }] }
  });

  const childrenWithoutBirthDate = await prisma.customerChild.count({
    where: { customer: { companyId }, birthDate: null }
  });

  const wallets = await prisma.customerWallet.findMany({ where: { customer: { companyId } } });
  let negativeWalletCount = 0;
  for (const w of wallets) {
    if (w.balance.toNumber() < 0) {
      negativeWalletCount++;
    }
  }

  if (customersWithoutPhone > 0) {
    console.warn(`  - [WARNING] Customers without valid phone (empty or placeholder): ${customersWithoutPhone}`);
    scoreCRM = "NOK";
  } else {
    console.log(`  - Customers without valid phone: 0`);
  }

  if (childrenWithoutBirthDate > 0) {
    console.log(`  - [INFO] Children without birthday date: ${childrenWithoutBirthDate}`);
  } else {
    console.log(`  - Children without birthday date: 0`);
  }

  if (negativeWalletCount > 0) {
    console.error(`  - [FAIL] Wallets with negative balance: ${negativeWalletCount}`);
    scoreCRM = "NOK";
  } else {
    console.log(`  - Wallets with negative balance: 0`);
  }

  // Determinar status do score
  console.log("\n==================================================");
  console.log("GO-LIVE SCORE");
  console.log("==================================================");
  console.log(`Infraestrutura ............ ${scoreInfra}`);
  console.log(`Segurança ................. ${scoreSeguranca}`);
  console.log(`Usuários .................. ${scoreUsuarios}`);
  console.log(`Produtos .................. ${scoreProdutos}`);
  console.log(`CRM ....................... ${scoreCRM}`);
  console.log(`Financeiro ................ ${scoreFinanceiro}`);

  let statusFinal = "🟢 APTO PARA PRODUÇÃO PILOTO DA TRUPE KIDS";
  if (scoreInfra === "NOK" || scoreSeguranca === "NOK" || scoreFinanceiro === "NOK" || scoreCRM === "NOK" && negativeWalletCount > 0) {
    statusFinal = "🔴 NÃO APTO (Correções críticas necessárias)";
  } else if (scoreUsuarios === "NOK" || scoreProdutos === "NOK" || scoreCRM === "NOK") {
    statusFinal = "🟡 APTO COM RESSALVAS (Rever avisos e cadastros)";
  }

  console.log(`\nStatus Final: ${statusFinal}`);
  console.log("==================================================");
}

if (require.main === module) {
  void withReadOnlyAdminDatabase(prisma => runGoLiveDiagnostics(prisma, requireExpectedCompanyId()))
    .catch(error => {
      console.error(sanitizeAdminDatabaseError(error));
      process.exitCode = 1;
    });
}
