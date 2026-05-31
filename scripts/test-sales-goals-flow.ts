import { PrismaClient } from "@prisma/client";
import { createSellerAction, updateSellerAction } from "../src/lib/sales/actions/create-seller-action"; // they are in different files now but we can import from service or action
import { updateSellerAction as updateS } from "../src/lib/sales/actions/update-seller-action";
import { createSellerGoalAction } from "../src/lib/sales/actions/create-seller-goal-action";
import { updateSellerGoalAction } from "../src/lib/sales/actions/update-seller-goal-action";
import { salesService } from "../src/lib/sales/sales-service";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting Phase 6C Sales Goals & Commissions Flow Tests...");

  try {
    const company = await prisma.company.findFirst();
    if (!company) throw new Error("No company found for test.");

    // Habilitar configs comerciais na empresa
    await prisma.company.update({
      where: { id: company.id },
      data: {
        enableSellerCommission: true,
        enableSellerGoals: true
      }
    });

    const sellerUser = await prisma.user.findFirst({ where: { companyId: company.id } });
    if (!sellerUser) throw new Error("No user found for test.");

    let paymentMethod = await prisma.paymentMethod.findFirst({ where: { companyId: company.id } });
    if (!paymentMethod) {
      paymentMethod = await prisma.paymentMethod.create({
        data: {
          companyId: company.id,
          name: "Test Payment Method 6C",
          type: "CASH"
        }
      });
    }

    // Create some dummy products for the test
    const dummyProduct = await prisma.product.create({
      data: {
        companyId: company.id,
        name: "Test Product 6C",
        internalCode: `TST-6C-${Date.now()}`
      }
    });

    const variant = await prisma.productVariant.create({
      data: {
        productId: dummyProduct.id,
        name: "Variant 6C",
        sku: `SKU-6C-${Date.now()}`,
        costPrice: 10,
        salePrice: 20,
        currentStock: 10,
        availableStock: 10
      }
    });

    // 1. Criar vendedor (update user to seller)
    console.log("Case 1 & 2: Create and update seller...");
    const resCreateSeller = await createSellerAction({
      userId: sellerUser.id,
      isSeller: true,
      sellerCode: "VEND01",
      commissionRate: 5 // 5%
    });
    if (!resCreateSeller.success) throw new Error("Failed to create seller: " + resCreateSeller.error);

    const resUpdateSeller = await updateS({
      userId: sellerUser.id,
      isSeller: true,
      sellerCode: "VEND01",
      commissionRate: 10 // Mudou para 10%
    });
    if (!resUpdateSeller.success) throw new Error("Failed to update seller: " + resUpdateSeller.error);
    console.log("[PASS] Seller created and updated.");

    // 3. Criar meta e 4. Atualizar meta
    console.log("Case 3 & 4: Create and update seller goal...");
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const resCreateGoal = await createSellerGoalAction({
      userId: sellerUser.id,
      periodStart,
      periodEnd,
      targetAmount: 5000
    });
    if (!resCreateGoal.success) throw new Error("Failed to create goal: " + resCreateGoal.error);
    
    let goalId = (resCreateGoal.goal as any).id;
    const resUpdateGoal = await updateSellerGoalAction({
      goalId,
      targetAmount: 10000
    });
    if (!resUpdateGoal.success) throw new Error("Failed to update goal");
    console.log("[PASS] Goal created and updated.");

    // 6. Venda gera comissão e 7. Venda atualiza meta
    console.log("Case 5, 6 & 7: Sale generates commission and updates goal...");
    const sale = await salesService.createSale({
      companyId: company.id,
      sellerId: sellerUser.id,
      subtotal: 100,
      totalAmount: 100,
      items: [
        {
          variantId: variant.id,
          productNameSnapshot: dummyProduct.name,
          variantNameSnapshot: variant.name,
          skuSnapshot: variant.sku,
          quantity: 2,
          unitPrice: 50,
          totalPrice: 100,
          costPriceAtSale: 10,
          salePriceAtSale: 50,
          marginAtSale: 80
        }
      ],
      payments: [
        {
          paymentMethodId: paymentMethod.id,
          amount: 100
        }
      ]
    });

    const commission = await prisma.sellerCommission.findFirst({ where: { saleId: sale.id } });
    if (!commission || commission.amount.toNumber() !== 10) throw new Error("Commission not created correctly. Expected 10.");
    console.log("[PASS] Commission created with correct amount (10% of 100 = 10).");

    const goalAfterSale = await prisma.sellerGoal.findUnique({ where: { id: goalId } });
    if (goalAfterSale?.achievedAmount.toNumber() !== 100) throw new Error("Goal achievedAmount not updated correctly.");
    console.log("[PASS] Goal achievedAmount updated correctly to 100.");

    // 8. Cancelamento estorna comissão e 9. Cancelamento estorna meta
    console.log("Case 8 & 9: Cancel sale reverses commission and goal...");
    await salesService.cancelSale({
      saleId: sale.id,
      cancelReason: "Testing reversal",
      cancelledByUserId: sellerUser.id
    });

    const commAfterCancel = await prisma.sellerCommission.findUnique({ where: { id: commission.id } });
    if (commAfterCancel?.status !== "CANCELLED") throw new Error("Commission status not updated to CANCELLED.");
    console.log("[PASS] Commission cancelled.");

    const goalAfterCancel = await prisma.sellerGoal.findUnique({ where: { id: goalId } });
    if (goalAfterCancel?.achievedAmount.toNumber() !== 0) throw new Error("Goal achievedAmount not reversed correctly.");
    console.log("[PASS] Goal achievedAmount reversed correctly to 0.");

    // Cleanup
    await prisma.sellerCommission.deleteMany({ where: { saleId: sale.id } });
    await prisma.sellerGoal.delete({ where: { id: goalId } });
    await prisma.sale.delete({ where: { id: sale.id } });
    await prisma.productVariant.delete({ where: { id: variant.id } });
    await prisma.product.delete({ where: { id: dummyProduct.id } });
    await prisma.paymentMethod.deleteMany({ where: { name: "Test Payment Method 6C" } });
    
    // Reset config commercial
    await prisma.company.update({
      where: { id: company.id },
      data: {
        enableSellerCommission: false,
        enableSellerGoals: false
      }
    });

    console.log("==================================================");
    console.log("ALL PHASE 6C GOALS & COMMISSIONS TESTS PASSED!");
    console.log("==================================================");

  } catch (error) {
    console.error("[FAIL] Error during flow test:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
