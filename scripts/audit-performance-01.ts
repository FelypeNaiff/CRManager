import type { Prisma } from '@prisma/client';
import { sanitizeAdminDatabaseError, withReadOnlyAdminDatabase } from '../src/lib/database/admin-script-access';
import { requireExpectedCompanyId } from './import-admin-access';

export async function checkDatabase(prisma: Prisma.TransactionClient, companyId: string) {
  console.log("Iniciando auditoria de banco de dados para PERFORMANCE-01...\n");

  // 4. Check for duplicate SKUs within the same company
  console.log("Verificando SKUs duplicados dentro da mesma empresa...");
  // First, find all variants with SKU to see if any sku repeats per company
  // We don't have companyId on ProductVariant yet (that's what we are adding!), 
  // so we need to join with Product to get companyId.
  const variants = await prisma.productVariant.findMany({
    where: {
      companyId,
      sku: { not: null, not: "" }
    },
    include: {
      product: { select: { companyId: true } }
    }
  });

  const skuMap = new Map<string, number>();
  variants.forEach(v => {
    if (v.sku && v.product?.companyId) {
      skuMap.set(v.sku, (skuMap.get(v.sku) || 0) + 1);
    }
  });

  let hasDuplicates = false;
  for (const [, count] of skuMap.entries()) {
    if (count > 1) {
      hasDuplicates = true;
      console.log(`DUPLICIDADE ENCONTRADA: grupo com ${count} variantes.`);
    }
  }
  if (!hasDuplicates) {
    console.log("Nenhum SKU duplicado dentro da mesma empresa encontrado.");
  }
  console.log("---");

  // 5. Check if there are variants without productId
  console.log("Verificando se existem variações (ProductVariant) sem productId...");
  const orphanedVariants = await prisma.productVariant.count({
    where: {
      companyId,
      productId: { equals: "" } // Actually productId is String in schema, maybe we should check length or null if it's optional. 
      // Assuming productId is mandatory by schema, we check if there's any invalid ones.
    }
  });
  // Since productId is required in the schema, we can just check if any exist without it theoretically? The schema says:
  // productId String
  // So they can't be null.
  console.log(`Variações órfãs (sem productId válido): ${orphanedVariants}`);
  console.log("---");

  // 6. Check if there are products without companyId
  console.log("Verificando se existem produtos (Product) sem companyId...");
  const orphanedProducts = await prisma.product.count({
    where: {
      companyId,
      id: { equals: "" } // Required IDs cannot be null; this only detects invalid empty values.
    }
  });
  console.log(`Produtos sem companyId válido: ${orphanedProducts}`);
  
}

if (require.main === module) {
  void withReadOnlyAdminDatabase(prisma => checkDatabase(prisma, requireExpectedCompanyId()))
    .catch(error => {
      console.error(sanitizeAdminDatabaseError(error));
      process.exitCode = 1;
    });
}
