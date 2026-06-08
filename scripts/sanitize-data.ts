import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function runDataSanitization() {
  const dryRun = process.env.DRY_RUN !== "false";
  
  // Detect if we are in production
  const dbUrl = process.env.DATABASE_URL || "";
  const isProduction = 
    process.env.NODE_ENV === "production" || 
    process.env.ENVIRONMENT === "production" || 
    process.env.PRODUCTION === "true" ||
    dbUrl.includes("supabase.co") ||
    dbUrl.includes("aws-0-sa-east-1");

  const allowProductionSanitize = process.env.ALLOW_PRODUCTION_SANITIZE === "true";

  console.log("==================================================");
  console.log("NEEX DATA SANITIZATION SERVICE");
  console.log("==================================================");
  console.log(`Environment Detected : ${isProduction ? "PRODUCTION" : "HOMOLOGATION/LOCAL"}`);
  console.log(`Execution Mode       : ${dryRun ? "DRY-RUN (Simulação)" : "REAL EXECUTION (Escrita)"}`);
  if (isProduction) {
    console.log(`Production Write Flag: ${allowProductionSanitize ? "ALLOWED" : "BLOCKED"}`);
  }
  console.log("==================================================");

  const company = await prisma.company.findFirst();
  if (!company) {
    console.error("  [FAIL] No company found in database.");
    process.exit(1);
  }

  let hasCriticalPendingIssues = false;
  
  const report = {
    usersCorrected: [] as string[],
    usersPending: [] as string[],
    productsCategorized: [] as string[],
    variantsZeroPriceOrCost: [] as string[],
    variantsNegativeStock: [] as string[],
    variantsMissingSKU: [] as string[],
    customersMissingPhone: [] as string[],
    childrenMissingBirthday: [] as string[]
  };

  // 1. SANITIZE ROLES AND USERS
  console.log("\n1. Auditing Users and Roles...");
  
  // Find or create default "Vendedor" role
  let sellerRole = await prisma.role.findFirst({
    where: { companyId: company.id, name: "Vendedor" }
  });

  if (!sellerRole) {
    if (!dryRun && (!isProduction || allowProductionSanitize)) {
      sellerRole = await prisma.role.create({
        data: { companyId: company.id, name: "Vendedor", isAdmin: false }
      });
      console.log(`  [WRITE] Created default 'Vendedor' role.`);
    } else {
      console.log(`  [DRY-RUN/BLOCKED] Would create default 'Vendedor' role.`);
    }
  }

  const usersWithoutRole = await prisma.user.findMany({ where: { roleId: null } });
  for (const u of usersWithoutRole) {
    if (!dryRun && (!isProduction || allowProductionSanitize)) {
      if (sellerRole) {
        await prisma.user.update({
          where: { id: u.id },
          data: { roleId: sellerRole.id }
        });
        report.usersCorrected.push(`Role Vendedor -> User: ${u.name} (${u.email})`);
        console.log(`  [WRITE] Associated user '${u.name}' to 'Vendedor' role.`);
      } else {
        report.usersPending.push(`User: ${u.name} (Role creation blocked/dryrun)`);
        console.log(`  [PENDING] User '${u.name}' needs role assignment.`);
      }
    } else {
      report.usersPending.push(`User: ${u.name}`);
      console.log(`  [DRY-RUN/BLOCKED] Would associate user '${u.name}' to 'Vendedor' role.`);
    }
  }

  // Active users without authorization PIN
  const usersWithoutPin = await prisma.user.findMany({
    where: { status: "ACTIVE", authorizationPinHash: null }
  });

  const tempPinHash = bcrypt.hashSync("1234", 10);
  for (const u of usersWithoutPin) {
    if (!dryRun && (!isProduction || allowProductionSanitize)) {
      await prisma.user.update({
        where: { id: u.id },
        data: {
          authorizationPinHash: tempPinHash,
          pinResetRequired: true
        }
      });
      report.usersCorrected.push(`PIN Configured -> User: ${u.name}`);
      console.log(`  [WRITE] Set temporary PIN ('1234') for user '${u.name}'.`);
    } else {
      report.usersPending.push(`User PIN: ${u.name}`);
      console.log(`  [DRY-RUN/BLOCKED] Would set temporary PIN for user '${u.name}'.`);
    }
  }

  // If we couldn't resolve these issues, they are critical
  if (report.usersPending.length > 0) {
    hasCriticalPendingIssues = true;
  }

  // 2. SANITIZE PRODUCT CATEGORIES
  console.log("\n2. Auditing Product Categories...");
  
  let defaultCategory = await prisma.productCategory.findFirst({
    where: { companyId: company.id, name: "Geral" }
  });

  if (!defaultCategory) {
    if (!dryRun && (!isProduction || allowProductionSanitize)) {
      defaultCategory = await prisma.productCategory.create({
        data: { companyId: company.id, name: "Geral", isActive: true }
      });
      console.log(`  [WRITE] Created default product category 'Geral'.`);
    } else {
      console.log(`  [DRY-RUN/BLOCKED] Would create default product category 'Geral'.`);
    }
  }

  const productsWithoutCategory = await prisma.product.findMany({ where: { categoryId: null } });
  for (const p of productsWithoutCategory) {
    if (!dryRun && (!isProduction || allowProductionSanitize)) {
      if (defaultCategory) {
        await prisma.product.update({
          where: { id: p.id },
          data: { categoryId: defaultCategory.id }
        });
        report.productsCategorized.push(p.name);
        console.log(`  [WRITE] Categorized product '${p.name}' under 'Geral'.`);
      } else {
        console.log(`  [PENDING] Product '${p.name}' needs category assignment.`);
      }
    } else {
      report.productsCategorized.push(p.name);
      console.log(`  [DRY-RUN/BLOCKED] Would categorize product '${p.name}' under 'Geral'.`);
    }
  }

  // 3. AUDIT PRODUCTS & VARIANTS (PRICES / COSTS / SKU / STOCK)
  console.log("\n3. Auditing Variant Prices, Costs, SKUs, and Stock...");
  const variants = await prisma.productVariant.findMany({ include: { product: true } });

  for (const v of variants) {
    const isZeroPrice = v.salePrice.toNumber() <= 0;
    const isZeroCost = v.costPrice.toNumber() <= 0;
    const isNegativeStock = v.currentStock.toNumber() < 0 || v.availableStock.toNumber() < 0;
    const isMissingSku = !v.sku || v.sku.trim() === "";

    if (isZeroPrice || isZeroCost) {
      report.variantsZeroPriceOrCost.push(`Variant: ${v.product.name} - ${v.name} (Price: R$ ${v.salePrice}, Cost: R$ ${v.costPrice})`);
      hasCriticalPendingIssues = true;
    }

    if (isNegativeStock) {
      report.variantsNegativeStock.push(`Variant: ${v.product.name} - ${v.name} (Stock: ${v.currentStock})`);
      hasCriticalPendingIssues = true;
    }

    if (isMissingSku) {
      report.variantsMissingSKU.push(`Variant: ${v.product.name} - ${v.name}`);
      hasCriticalPendingIssues = true;
    }

    // SANITIZATION FOR HOMOLOGATION/LOCAL
    if (!isProduction && !dryRun) {
      let needsUpdate = false;
      let updateData: any = {};

      if (isZeroPrice) {
        updateData.salePrice = 20.00;
        needsUpdate = true;
      }
      if (isZeroCost) {
        updateData.costPrice = 10.00;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await prisma.productVariant.update({
          where: { id: v.id },
          data: updateData
        });
        console.log(`  [WRITE/HOMOLOG] Sanitized prices for variant '${v.name}' of product '${v.product.name}'.`);
      }
    } else if (isProduction && (isZeroPrice || isZeroCost)) {
      console.log(`  [PENDING/PROD] Zero price/cost on '${v.product.name} - ${v.name}' cannot be resolved automatically.`);
    }
  }

  // 4. AUDIT CRM DATA (PHONES & BIRTHDAYS)
  console.log("\n4. Auditing CRM Customers and Birthdays...");
  
  const customersWithoutPhone = await prisma.customer.findMany({
    where: { OR: [{ phone: "" }, { phoneIsPlaceholder: true }] }
  });

  for (const c of customersWithoutPhone) {
    report.customersMissingPhone.push(`Customer: ${c.name} (Phone: '${c.phone}')`);
    
    if (!isProduction && !dryRun && c.phone === "") {
      await prisma.customer.update({
        where: { id: c.id },
        data: { phone: "11900000000", phoneIsPlaceholder: true }
      });
      console.log(`  [WRITE/HOMOLOG] Set placeholder phone for customer '${c.name}'.`);
    }
  }

  const childrenWithoutBirthDate = await prisma.customerChild.findMany({
    where: { birthDate: null },
    include: { customer: true }
  });

  for (const child of childrenWithoutBirthDate) {
    report.childrenMissingBirthday.push(`Child: ${child.name} (Parent: ${child.customer.name})`);

    if (!isProduction && !dryRun) {
      await prisma.customerChild.update({
        where: { id: child.id },
        data: { birthDate: new Date("2020-01-01T00:00:00Z") }
      });
      console.log(`  [WRITE/HOMOLOG] Set default birthday for child '${child.name}'.`);
    }
  }

  // ===========================================================================
  // REPORT OUTPUT
  // ===========================================================================
  console.log("\n==================================================");
  console.log("SANITY AND DATA QUALITY AUDIT REPORT");
  console.log("==================================================");
  console.log(`Ambiente                  : ${isProduction ? "PRODUÇÃO" : "HOMOLOGAÇÃO/LOCAL"}`);
  console.log(`Modo de Execução          : ${dryRun ? "DRY-RUN (Simulado)" : "ESCRITA REAL"}`);
  console.log(`Usuários Corrigidos       : ${report.usersCorrected.length}`);
  console.log(`Usuários Pendentes        : ${report.usersPending.length}`);
  console.log(`Produtos Categorizados    : ${report.productsCategorized.length}`);
  console.log(`Variantes com Custo/Preço=0: ${report.variantsZeroPriceOrCost.length}`);
  console.log(`Variantes Estoque Negativo: ${report.variantsNegativeStock.length}`);
  console.log(`Variantes sem SKU         : ${report.variantsMissingSKU.length}`);
  console.log(`Clientes c/ Telefone Pend.: ${report.customersMissingPhone.length}`);
  console.log(`Filhos sem Nasc. Pendente : ${report.childrenMissingBirthday.length}`);
  
  let goLiveScore = "🟢 APTO";
  if (hasCriticalPendingIssues) {
    goLiveScore = isProduction 
      ? "🔴 NÃO APTO (Pendências críticas em produção)"
      : "🟡 APTO COM RESSALVAS (Dados simulados em homologação)";
  } else if (report.customersMissingPhone.length > 0 || report.childrenMissingBirthday.length > 0) {
    goLiveScore = "🟡 APTO COM RESSALVAS (Pendências não-críticas)";
  }

  console.log(`Status Go-Live SCORE      : ${goLiveScore}`);
  console.log("==================================================");

  if (isProduction && hasCriticalPendingIssues) {
    console.error("  [ERROR] Critical database issues detected on production. Exiting with code 1.");
    process.exit(1);
  } else {
    console.log("  Audit finished successfully.");
    process.exit(0);
  }
}

runDataSanitization()
  .catch(err => {
    console.error("Critical script error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
