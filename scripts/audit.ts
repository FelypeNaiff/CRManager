import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companyId = '2052613e-1e1a-4796-95cd-eb2b35ef7eb9';
  console.log("=== EXPLAIN ANALYZE ===");

  try {
    // 1. Produtos
    console.log("\n[PRODUTOS]");
    const prodRes: any = await prisma.$queryRaw`EXPLAIN ANALYZE SELECT * FROM "Product" WHERE "companyId" = ${companyId} AND "isActive" = true ORDER BY "name" ASC LIMIT 50`;
    console.log(prodRes.map((r: any) => r['QUERY PLAN']).join('\n'));

    // 2. Movimentações
    console.log("\n[MOVIMENTACOES]");
    const movRes: any = await prisma.$queryRaw`
      EXPLAIN ANALYZE 
      SELECT m.* FROM "InventoryMovement" m
      INNER JOIN "ProductVariant" v ON m."variantId" = v."id"
      WHERE v."companyId" = ${companyId}
      ORDER BY m."createdAt" DESC LIMIT 50
    `;
    console.log(movRes.map((r: any) => r['QUERY PLAN']).join('\n'));

    // 3. PDV Search
    console.log("\n[PDV SEARCH]");
    const q = '123';
    const pdvRes: any = await prisma.$queryRaw`
      EXPLAIN ANALYZE 
      SELECT * FROM "ProductVariant"
      WHERE "companyId" = ${companyId}
      AND "isActive" = true
      AND ("sku" = ${q} OR "barcode" = ${q} OR "name" ILIKE ${'%' + q + '%'})
      LIMIT 20
    `;
    console.log(pdvRes.map((r: any) => r['QUERY PLAN']).join('\n'));

    // 4. Vendas
    console.log("\n[VENDAS]");
    const salesRes: any = await prisma.$queryRaw`
      EXPLAIN ANALYZE 
      SELECT * FROM "Sale"
      WHERE "companyId" = ${companyId}
      ORDER BY "createdAt" DESC LIMIT 30
    `;
    console.log(salesRes.map((r: any) => r['QUERY PLAN']).join('\n'));

  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
