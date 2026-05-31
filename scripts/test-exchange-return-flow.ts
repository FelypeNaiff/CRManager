import { PrismaClient } from "@prisma/client";
import { ExchangeService } from "../src/lib/sales/exchange-service";

const prisma = new PrismaClient();
const exchangeService = new ExchangeService();

async function runTests() {
  console.log("Starting Phase 6G Exchange Return Tests...");
  
  const company = await prisma.company.findFirst();
  if (!company) throw new Error("No company found");

  let customer = await prisma.customer.findFirst({ where: { companyId: company.id, email: "test_exchange@test.com" } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: { 
        companyId: company.id, 
        name: "Test Exchange", 
        email: `test_exchange_${Date.now()}@test.com`,
        phone: `119${Math.floor(Math.random() * 100000000)}`
      }
    });
  }

  const seller = await prisma.user.findFirst({ where: { companyId: company.id, isSeller: true } });
  if (!seller) throw new Error("No seller found");

  const cashRegister = await prisma.cashRegister.findFirst({ where: { companyId: company.id, status: "OPEN" } });
  if (!cashRegister) throw new Error("No open cash register found");

  const product = await prisma.product.findFirst({ where: { companyId: company.id } });
  if (!product) throw new Error("No product found");

  const variant = await prisma.productVariant.findFirst({ where: { productId: product.id } });
  if (!variant) throw new Error("No variant found");

  // Create a base sale with customer
  const saleBase = await prisma.sale.create({
    data: {
      companyId: company.id,
      sellerId: seller.id,
      customerId: customer.id,
      cashRegisterId: cashRegister.id,
      status: "PAID",
      subtotal: 300,
      discountAmount: 0,
      totalAmount: 300,
      items: {
        create: [
          {
            variantId: variant.id,
            quantity: 3,
            unitPrice: 100,
            discount: 0,
            totalPrice: 300,
            productNameSnapshot: product.name,
            variantNameSnapshot: variant.name,
            skuSnapshot: variant.sku,
            costPriceAtSale: 50,
            salePriceAtSale: 100,
            marginAtSale: 50
          }
        ]
      },
      commissions: {
        create: {
          userId: seller.id,
          amount: 30, // 10%
          status: "PENDING"
        }
      }
    },
    include: { items: true, commissions: true }
  });

  const now = new Date();
  let goal = await prisma.sellerGoal.findFirst({
    where: { 
      userId: seller.id,
      periodStart: { lte: now },
      periodEnd: { gte: now }
    }
  });
  if (!goal) {
    goal = await prisma.sellerGoal.create({
      data: {
        userId: seller.id,
        targetAmount: 1000,
        achievedAmount: 300,
        periodStart: new Date(),
        periodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1))
      }
    });
  } else {
    goal = await prisma.sellerGoal.update({
      where: { id: goal.id },
      data: { achievedAmount: 300 } // Reset
    });
  }

  // Set Variant Stock
  await prisma.productVariant.update({
    where: { id: variant.id },
    data: { currentStock: 100, availableStock: 100 }
  });

  // Test 3: Bloqueio de crédito sem cliente
  console.log("Test: Bloqueio de devolução sem cliente...");
  const saleNoCustomer = await prisma.sale.create({
    data: {
      companyId: company.id,
      sellerId: seller.id,
      cashRegisterId: cashRegister.id,
      status: "PAID",
      subtotal: 100,
      totalAmount: 100,
      items: {
        create: [
          {
            variantId: variant.id,
            quantity: 1,
            unitPrice: 100,
            discount: 0,
            totalPrice: 100,
            productNameSnapshot: product.name,
            variantNameSnapshot: variant.name,
            skuSnapshot: variant.sku,
            costPriceAtSale: 50,
            salePriceAtSale: 100,
            marginAtSale: 50
          }
        ]
      }
    }
  });

  try {
    await exchangeService.processExchangeReturn({
      companyId: company.id,
      saleId: saleNoCustomer.id,
      userId: seller.id,
      type: "RETURN",
      items: [{ variantId: variant.id, quantity: 1, condition: "RESALE" }]
    });
    throw new Error("Should have blocked without customer");
  } catch (e: any) {
    if (e.message.includes("Não é possível gerar crédito sem um cliente")) {
      console.log("[PASS] Bloqueio sem cliente verificado.");
    } else {
      throw e;
    }
  }

  // Tests 1, 2, 5, 8, 11, 12, 13, 15: Devolução Parcial (1 item RESALE)
  console.log("Test: Devolução Parcial (RESALE)...");
  const res1 = await exchangeService.processExchangeReturn({
    companyId: company.id,
    saleId: saleBase.id,
    userId: seller.id,
    type: "RETURN",
    reason: "Não gostou",
    items: [{ variantId: variant.id, quantity: 1, condition: "RESALE" }]
  });

  if (!res1.success || res1.totalCredit !== 100) throw new Error("Failed to process return correctly");

  const wallet = await prisma.customerWallet.findUnique({ where: { customerId: customer.id } });
  if (!wallet || wallet.balance.toNumber() !== 100) throw new Error("Wallet not credited correctly");
  console.log("[PASS] Geração de crédito confirmada.");

  const varAfter1 = await prisma.productVariant.findUnique({ where: { id: variant.id } });
  if (varAfter1!.availableStock.toNumber() !== 101) throw new Error("Stock not incremented for RESALE");
  console.log("[PASS] Retorno ao availableStock quando RESALE.");

  const saleAfter1 = await prisma.sale.findUnique({ where: { id: saleBase.id }, include: { commissions: true } });
  if (saleAfter1!.status !== "PARTIALLY_RETURNED") throw new Error("Status not PARTIALLY_RETURNED");
  console.log("[PASS] Sale.status PARTIALLY_RETURNED.");

  if (saleAfter1!.commissions[0]!.amount.toNumber() !== 20) throw new Error("Commission not reduced correctly");
  console.log("[PASS] Comissão reduzida proporcionalmente.");

  const goalAfter1 = await prisma.sellerGoal.findUnique({ where: { id: goal.id } });
  if (goalAfter1!.achievedAmount.toNumber() !== 200) throw new Error("Goal not reduced correctly");
  console.log("[PASS] Meta reduzida proporcionalmente.");

  const log1 = await prisma.activityLog.findFirst({ where: { recordId: saleBase.id, action: "CREATE_RETURN" } });
  if (!log1) throw new Error("ActivityLog not created");
  console.log("[PASS] ActivityLog criado.");

  // Test 7: Bloqueio de devolução acima do vendido
  console.log("Test: Bloqueio de devolução acima do vendido...");
  try {
    await exchangeService.processExchangeReturn({
      companyId: company.id,
      saleId: saleBase.id,
      userId: seller.id,
      type: "RETURN",
      items: [{ variantId: variant.id, quantity: 3, condition: "RESALE" }] // Only 2 left to return
    });
    throw new Error("Should have blocked excess return");
  } catch (e: any) {
    if (e.message.includes("excede disponível para devolução")) {
      console.log("[PASS] Bloqueio acima do vendido.");
    } else {
      throw e;
    }
  }

  // Tests 6, 9, 10, 14: Devolução Total do restante (2 itens, 2 DAMAGED)
  console.log("Test: Devolução Total do restante (DAMAGED/DISCARD)...");
  
  await exchangeService.processExchangeReturn({
    companyId: company.id,
    saleId: saleBase.id,
    userId: seller.id,
    type: "EXCHANGE",
    items: [{ variantId: variant.id, quantity: 2, condition: "DAMAGED" }]
  });

  const varAfter2 = await prisma.productVariant.findUnique({ where: { id: variant.id } });
  if (varAfter2!.availableStock.toNumber() !== 101) throw new Error("Stock incorrectly incremented for DAMAGED");
  console.log("[PASS] Não retorno ao availableStock quando DAMAGED.");

  const saleAfter2 = await prisma.sale.findUnique({ where: { id: saleBase.id }, include: { commissions: true } });
  if (saleAfter2!.status !== "RETURNED") throw new Error("Status not RETURNED");
  console.log("[PASS] Sale.status RETURNED.");

  if (saleAfter2!.commissions[0]!.status !== "CANCELLED") throw new Error("Commission not CANCELLED on total return");
  console.log("[PASS] Comissão CANCELLED na devolução total.");

  console.log("==================================================");
  console.log("ALL PHASE 6G EXCHANGE RETURN TESTS PASSED!");
  console.log("==================================================");
  process.exit(0);
}

runTests().catch(e => {
  console.error("\n[FAIL] Error during exchange return tests:");
  console.error(e);
  process.exit(1);
});
