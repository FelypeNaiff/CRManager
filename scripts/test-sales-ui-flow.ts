import { PrismaClient } from "@prisma/client";
import { createSaleAction } from "../src/lib/sales/actions/create-sale-action";
import { cancelSaleAction } from "../src/lib/sales/actions/cancel-sale-action";
import { getSaleAction } from "../src/lib/sales/actions/get-sale-action";
import { listSalesAction } from "../src/lib/sales/actions/list-sales-action";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting Phase 6D Sales UI Flow Tests...");

  try {
    const company = await prisma.company.findFirst();
    if (!company) throw new Error("No company found for test.");

    const sellerUser = await prisma.user.findFirst({ where: { companyId: company.id } });
    if (!sellerUser) throw new Error("No user found for test.");

    let paymentMethod = await prisma.paymentMethod.findFirst({ where: { companyId: company.id } });
    if (!paymentMethod) {
      paymentMethod = await prisma.paymentMethod.create({
        data: {
          companyId: company.id,
          name: "Test Payment Method 6D",
          type: "CASH"
        }
      });
    }

    const dummyProduct = await prisma.product.create({
      data: {
        companyId: company.id,
        name: "Test Product 6D",
        internalCode: `TST-6D-${Date.now()}`
      }
    });

    const variant = await prisma.productVariant.create({
      data: {
        productId: dummyProduct.id,
        name: "Variant 6D",
        sku: `SKU-6D-${Date.now()}`,
        costPrice: 10,
        salePrice: 20,
        currentStock: 10,
        availableStock: 10
      }
    });

    // 1. Criar venda (simulate UI submit)
    console.log("Case 1: Create sale (Nova Venda)...");
    const resCreate = await createSaleAction({
      companyId: company.id,
      sellerId: sellerUser.id,
      subtotal: 40,
      totalAmount: 40,
      discountAmount: 0,
      items: [
        {
          variantId: variant.id,
          productNameSnapshot: dummyProduct.name,
          variantNameSnapshot: variant.name,
          skuSnapshot: variant.sku,
          quantity: 2,
          unitPrice: 20,
          discount: 0,
          totalPrice: 40,
          costPriceAtSale: 10,
          salePriceAtSale: 20,
          marginAtSale: 50
        }
      ],
      payments: [
        {
          paymentMethodId: paymentMethod.id,
          amount: 40,
          installments: 1
        }
      ]
    });

    if (!resCreate.success) throw new Error("Failed to create sale: " + resCreate.error);
    const saleId = (resCreate.sale as any).id;
    console.log("[PASS] Sale created.");

    // 2. Listar venda
    console.log("Case 2: List sales...");
    const resList = await listSalesAction(company.id, { sellerId: sellerUser.id });
    if (!resList.success) throw new Error("Failed to list sales");
    const foundSale = resList.sales?.find((s: any) => s.id === saleId);
    if (!foundSale) throw new Error("Sale not found in list");
    console.log("[PASS] Sale listed.");

    // 3. Consultar venda (Detalhe)
    console.log("Case 3: Get sale details...");
    const resGet = await getSaleAction(saleId);
    if (!resGet.success) throw new Error("Failed to get sale details");
    if (resGet.sale?.commissions?.length === undefined) throw new Error("Commissions not included in sale details");
    console.log("[PASS] Sale details retrieved with relations.");

    // 4. Cancelar venda
    console.log("Case 4: Cancel sale...");
    const resCancel = await cancelSaleAction({
      saleId,
      cancelReason: "Test cancellation from UI flow",
      cancelledByUserId: sellerUser.id
    });
    if (!resCancel.success) throw new Error("Failed to cancel sale: " + resCancel.error);
    console.log("[PASS] Sale cancelled successfully.");

    // Cleanup
    await prisma.sellerCommission.deleteMany({ where: { saleId: saleId } });
    await prisma.sale.delete({ where: { id: saleId } });
    await prisma.productVariant.delete({ where: { id: variant.id } });
    await prisma.product.delete({ where: { id: dummyProduct.id } });
    await prisma.paymentMethod.deleteMany({ where: { name: "Test Payment Method 6D" } });

    console.log("==================================================");
    console.log("ALL PHASE 6D UI FLOW TESTS PASSED!");
    console.log("==================================================");

  } catch (error) {
    console.error("[FAIL] Error during flow test:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
