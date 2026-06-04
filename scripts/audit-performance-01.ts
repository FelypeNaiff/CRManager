import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
  console.log("Iniciando auditoria de banco de dados para PERFORMANCE-01...\n");

  // 4. Check for duplicate SKUs within the same company
  console.log("Verificando SKUs duplicados dentro da mesma empresa...");
  // First, find all variants with SKU to see if any sku repeats per company
  // We don't have companyId on ProductVariant yet (that's what we are adding!), 
  // so we need to join with Product to get companyId.
  const variants = await prisma.productVariant.findMany({
    where: {
      sku: { not: null, not: "" }
    },
    include: {
      product: { select: { companyId: true } }
    }
  });

  const skuMap = new Map<string, string[]>(); // key: companyId+sku, value: variantIds
  variants.forEach(v => {
    if (v.sku && v.product?.companyId) {
      const key = `${v.product.companyId}::${v.sku}`;
      const existing = skuMap.get(key) || [];
      existing.push(v.id);
      skuMap.set(key, existing);
    }
  });

  let hasDuplicates = false;
  for (const [key, ids] of skuMap.entries()) {
    if (ids.length > 1) {
      hasDuplicates = true;
      console.log(`DUPLICIDADE ENCONTRADA: ${key} -> variants: ${ids.join(', ')}`);
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
      companyId: { equals: "" } // Again, it's mandatory in schema, but could be empty string
    }
  });
  console.log(`Produtos sem companyId válido: ${orphanedProducts}`);
  
  await prisma.$disconnect();
}

checkDatabase().catch(e => {
  console.error(e);
  process.exit(1);
});
