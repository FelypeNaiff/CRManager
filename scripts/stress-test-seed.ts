import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando Teste de Carga de Produtos...");

  // Identifica a primeira empresa (ou passa via env)
  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error("Nenhuma empresa cadastrada no banco de dados.");
  }

  // Pega um depósito padrão (ou cria um se não existir)
  let warehouse = await prisma.warehouse.findFirst({
    where: { companyId: company.id }
  });

  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: {
        companyId: company.id,
        name: "[STRESS] Depósito Principal",
        isActive: true,
      }
    });
  }

  const TOTAL_PRODUCTS = 5000;
  const CHUNK_SIZE = 500;

  console.time("Tempo Total de Inserção");

  for (let batch = 0; batch < TOTAL_PRODUCTS / CHUNK_SIZE; batch++) {
    const productsData = [];

    for (let i = 0; i < CHUNK_SIZE; i++) {
      const idx = batch * CHUNK_SIZE + i;
      
      const salePrice1 = (Math.random() * 230 + 20).toFixed(2);
      const costPrice1 = (Number(salePrice1) / 2).toFixed(2);
      const stock1 = Math.floor(Math.random() * 90 + 10);

      const salePrice2 = (Math.random() * 230 + 20).toFixed(2);
      const costPrice2 = (Number(salePrice2) / 2).toFixed(2);
      const stock2 = Math.floor(Math.random() * 90 + 10);

      productsData.push({
        companyId: company.id,
        name: `[TESTE DE CARGA] Produto ${idx}`,
        internalCode: `STRESS-PRD-${idx}`,
        salesUnit: "UN",
        trackStock: true,
        pdvEligible: true,
        isActive: true,
        variants: {
          create: [
            {
              companyId: company.id,
              name: "P",
              sku: `STRESS-SKU-${idx}-P`,
              salePrice: Number(salePrice1),
              costPrice: Number(costPrice1),
              currentStock: stock1,
              stockPositions: {
                create: {
                  companyId: company.id,
                  warehouseId: warehouse.id,
                  quantity: stock1
                }
              }
            },
            {
              companyId: company.id,
              name: "M",
              sku: `STRESS-SKU-${idx}-M`,
              salePrice: Number(salePrice2),
              costPrice: Number(costPrice2),
              currentStock: stock2,
              stockPositions: {
                create: {
                  companyId: company.id,
                  warehouseId: warehouse.id,
                  quantity: stock2
                }
              }
            }
          ]
        }
      });
    }

    // Prisma não suporta nested createMany com relations complexas facilmente de forma performática.
    // Vamos usar transações com promises para paralelizar o chunk
    console.log(`Inserindo lote ${batch + 1} de ${TOTAL_PRODUCTS / CHUNK_SIZE}...`);
    
    await prisma.$transaction(
      productsData.map(prod => prisma.product.create({ data: prod }))
    );
  }

  console.timeEnd("Tempo Total de Inserção");

  // TESTES DE BUSCA
  console.log("\nExecutando testes de latência na busca...");
  
  const searchQueries = [
    "Produto 10",
    "STRESS-PRD-400",
    "Produto 499",
    "STRESS-SKU-20",
    "TESTE DE CARGA"
  ];

  let totalLatency = 0;

  for (const query of searchQueries) {
    const start = performance.now();
    await prisma.product.findMany({
      where: {
        companyId: company.id,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { internalCode: { contains: query, mode: "insensitive" } },
          { variants: { some: { sku: { contains: query, mode: "insensitive" } } } }
        ]
      },
      take: 50,
      include: { variants: true }
    });
    const latency = performance.now() - start;
    console.log(`Busca por "${query}" levou ${latency.toFixed(2)}ms`);
    totalLatency += latency;
  }

  console.log(`\nLatência Média: ${(totalLatency / searchQueries.length).toFixed(2)}ms`);
  console.log("Teste de Carga finalizado com sucesso!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
