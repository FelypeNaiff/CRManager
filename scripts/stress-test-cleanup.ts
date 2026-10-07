import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando limpeza dos dados de Teste de Carga...");

  // Identifica a empresa
  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error("Nenhuma empresa cadastrada no banco de dados.");
  }

  // 1. Buscar e contabilizar todos os registros que contenham o prefixo STRESS-
  const countProducts = await prisma.product.count({
    where: { internalCode: { startsWith: 'STRESS-' }, companyId: company.id }
  });

  const countVariants = await prisma.productVariant.count({
    where: { sku: { startsWith: 'STRESS-' }, companyId: company.id }
  });

  console.log(`Identificados para exclusão: ${countProducts} Produtos e ${countVariants} Variantes.`);

  if (countProducts === 0 && countVariants === 0) {
    console.log("Nenhum registro de stress encontrado.");
    return;
  }

  console.time("Tempo de Limpeza");

  await prisma.$transaction(async (tx) => {
    console.log("Removendo movimentações e posições de estoque...");
    await tx.inventoryMovement.deleteMany({
      where: { variant: { sku: { startsWith: 'STRESS-' } } }
    });
    
    await tx.stockPosition.deleteMany({
      where: { variant: { sku: { startsWith: 'STRESS-' } } }
    });
    
    console.log("Removendo históricos de preços e fornecedores vinculados...");
    await tx.productPriceHistory.deleteMany({
      where: { product: { internalCode: { startsWith: 'STRESS-' } } }
    });
    
    await tx.productSupplier.deleteMany({
      where: { product: { internalCode: { startsWith: 'STRESS-' } } }
    });

    console.log("Removendo variantes de produto...");
    const deletedVariants = await tx.productVariant.deleteMany({
      where: { sku: { startsWith: 'STRESS-' } }
    });

    console.log("Removendo produtos principais...");
    const deletedProducts = await tx.product.deleteMany({
      where: { internalCode: { startsWith: 'STRESS-' } }
    });

    console.log(`\nLimpeza concluída: ${deletedProducts.count} produtos e ${deletedVariants.count} variantes removidos com sucesso!`);
  });

  console.timeEnd("Tempo de Limpeza");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
