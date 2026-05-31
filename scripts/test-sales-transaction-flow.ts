import { PrismaClient } from "@prisma/client";
import { salesService } from "../src/lib/sales/sales-service";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting Phase 6B Transaction Flow Tests...");

  try {
    const company = await prisma.company.findFirst();
    if (!company) throw new Error("No company found for test.");

    const seller = await prisma.user.findFirst({ where: { companyId: company.id } });
    if (!seller) throw new Error("No user found for test.");

    // Atualiza seller temporariamente para isSeller = true para passar na validação
    await prisma.user.update({
      where: { id: seller.id },
      data: { isSeller: true }
    });

    let paymentMethod = await prisma.paymentMethod.findFirst({ where: { companyId: company.id } });
    if (!paymentMethod) {
      paymentMethod = await prisma.paymentMethod.create({
        data: {
          companyId: company.id,
          name: "Test Payment Method",
          type: "CASH"
        }
      });
    }

    // Create some dummy products for the test
    const dummyProduct = await prisma.product.create({
      data: {
        companyId: company.id,
        name: "Test Product 6B",
        internalCode: `TST-${Date.now()}`
      }
    });

    const variant1 = await prisma.productVariant.create({
      data: {
        productId: dummyProduct.id,
        name: "Variant A",
        sku: `SKU-A-${Date.now()}`,
        costPrice: 10,
        salePrice: 20,
        currentStock: 10,
        availableStock: 10
      }
    });

    const variant2 = await prisma.productVariant.create({
      data: {
        productId: dummyProduct.id,
        name: "Variant B",
        sku: `SKU-B-${Date.now()}`,
        costPrice: 15,
        salePrice: 30,
        currentStock: 5,
        availableStock: 5
      }
    });

    // Case 1: Criar venda simples e Case 3: Estoque atualizado e Case 4: ActivityLog criado
    console.log("Case 1, 3 & 4: Create simple sale, verify stock & log...");
    const sale1 = await salesService.createSale({
      companyId: company.id,
      sellerId: seller.id,
      subtotal: 20,
      totalAmount: 20,
      items: [
        {
          variantId: variant1.id,
          productNameSnapshot: dummyProduct.name,
          variantNameSnapshot: variant1.name,
          skuSnapshot: variant1.sku,
          quantity: 2,
          unitPrice: 20,
          totalPrice: 40,
          costPriceAtSale: 10,
          salePriceAtSale: 20,
          marginAtSale: 50
        }
      ],
      payments: [
        {
          paymentMethodId: paymentMethod.id,
          amount: 40
        }
      ]
    });
    
    console.log(`[PASS] Sale 1 created with ID: ${sale1.id}`);
    
    // Verify stock
    const v1After = await prisma.productVariant.findUnique({ where: { id: variant1.id } });
    if (v1After?.availableStock.toNumber() !== 8) throw new Error("Stock not updated properly!");
    console.log(`[PASS] Stock updated. New available stock: ${v1After?.availableStock.toNumber()}`);

    // Verify Log
    const logs = await prisma.activityLog.findMany({ where: { recordId: sale1.id, action: "CREATE_SALE" } });
    if (logs.length === 0) throw new Error("ActivityLog not created!");
    console.log(`[PASS] ActivityLog created.`);

    // Case 2: Criar venda múltiplos itens
    console.log("Case 2: Create sale with multiple items...");
    const sale2 = await salesService.createSale({
      companyId: company.id,
      sellerId: seller.id,
      subtotal: 50,
      totalAmount: 50,
      items: [
        {
          variantId: variant1.id,
          productNameSnapshot: dummyProduct.name,
          variantNameSnapshot: variant1.name,
          skuSnapshot: variant1.sku,
          quantity: 1,
          unitPrice: 20,
          totalPrice: 20,
          costPriceAtSale: 10,
          salePriceAtSale: 20,
          marginAtSale: 50
        },
        {
          variantId: variant2.id,
          productNameSnapshot: dummyProduct.name,
          variantNameSnapshot: variant2.name,
          skuSnapshot: variant2.sku,
          quantity: 2,
          unitPrice: 30,
          totalPrice: 60,
          costPriceAtSale: 15,
          salePriceAtSale: 30,
          marginAtSale: 50
        }
      ],
      payments: [
        {
          paymentMethodId: paymentMethod.id,
          amount: 80
        }
      ]
    });
    console.log(`[PASS] Multiple items sale created: ${sale2.id}`);

    // Case 5: Rollback por estoque insuficiente
    console.log("Case 5: Test rollback for insufficient stock...");
    try {
      await salesService.createSale({
        companyId: company.id,
        sellerId: seller.id,
        subtotal: 100,
        totalAmount: 100,
        items: [
          {
            variantId: variant2.id,
            productNameSnapshot: dummyProduct.name,
            variantNameSnapshot: variant2.name,
            skuSnapshot: variant2.sku,
            quantity: 100, // Insufficient stock
            unitPrice: 30,
            totalPrice: 3000,
            costPriceAtSale: 15,
            salePriceAtSale: 30,
            marginAtSale: 50
          }
        ],
        payments: [
          {
            paymentMethodId: paymentMethod.id,
            amount: 3000
          }
        ]
      });
      throw new Error("Should have thrown insufficient stock error!");
    } catch (err: any) {
      if (!err.message.includes("Estoque insuficiente")) {
        throw new Error("Unexpected error message: " + err.message);
      }
      console.log(`[PASS] Insufficient stock blocked successfully.`);
    }

    // Case 6 & 7: Cancelamento e devolução de estoque
    console.log("Case 6 & 7: Cancel sale and verify stock return...");
    await salesService.cancelSale({
      saleId: sale1.id,
      cancelReason: "Cliente desistiu",
      cancelledByUserId: seller.id
    });
    console.log(`[PASS] Sale cancelled.`);

    const v1AfterCancel = await prisma.productVariant.findUnique({ where: { id: variant1.id } });
    if (v1AfterCancel?.availableStock.toNumber() !== 9) throw new Error("Stock not returned properly after cancel!");
    console.log(`[PASS] Stock returned successfully. Available: ${v1AfterCancel?.availableStock.toNumber()}`);

    // Case 8: Consulta de venda
    console.log("Case 8: Get sale by ID...");
    const fetchedSale = await salesService.getSaleById(sale2.id);
    if (!fetchedSale || fetchedSale.id !== sale2.id) throw new Error("Failed to fetch sale.");
    console.log(`[PASS] Sale fetched successfully.`);

    // Case 9: Listagem de vendas
    console.log("Case 9: List sales...");
    const list = await salesService.listSales(company.id);
    if (!Array.isArray(list) || list.length < 2) throw new Error("Failed to list sales properly.");
    console.log(`[PASS] List sales returned ${list.length} records.`);

    // Cleanup
    await prisma.sale.deleteMany({ where: { id: { in: [sale1.id, sale2.id] } } });
    await prisma.sale.deleteMany({ where: { id: { in: [sale1.id, sale2.id] } } });
    await prisma.productVariant.deleteMany({ where: { id: { in: [variant1.id, variant2.id] } } });
    await prisma.product.delete({ where: { id: dummyProduct.id } });
    await prisma.paymentMethod.deleteMany({ where: { name: "Test Payment Method" } });
    
    console.log("==================================================");
    console.log("ALL PHASE 6B TRANSACTION FLOW TESTS PASSED!");
    console.log("==================================================");

  } catch (error) {
    console.error("[FAIL] Error during transaction flow test:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
