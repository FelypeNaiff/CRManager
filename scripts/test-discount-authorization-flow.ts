import { PrismaClient } from "@prisma/client";
import { SalesService } from "../src/lib/sales/sales-service";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const salesService = new SalesService();

async function runTests() {
  console.log("Starting Phase 6F Discount Authorization Tests...");
  
  // Setup data
  const company = await prisma.company.findFirst();
  if (!company) throw new Error("No company found");

  const cashRegister = await prisma.cashRegister.findFirst({ where: { companyId: company.id, status: "OPEN" } });
  if (!cashRegister) throw new Error("No open cash register found");

  const adminPassword = "password123";
  const pinAccessHash = await bcrypt.hash("123456", 10);

  let adminUser = await prisma.user.findFirst({ where: { email: "admin_auth@test.com" } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        companyId: company.id,
        name: "Admin Auth",
        email: "admin_auth@test.com",
        pinAccessHash,
        status: "ACTIVE",
        isSeller: true,
        permitirAcesso: true,
        maxDiscountPercentage: 100 // Admin pode dar ate 100%
      }
    });
  } else {
    adminUser = await prisma.user.update({
      where: { id: adminUser.id },
      data: { pinAccessHash, maxDiscountPercentage: 100, status: "ACTIVE" }
    });
  }

  let normalSeller = await prisma.user.findFirst({ where: { email: "seller_auth@test.com" } });
  if (!normalSeller) {
    normalSeller = await prisma.user.create({
      data: {
        companyId: company.id,
        name: "Seller Auth",
        email: "seller_auth@test.com",
        pinAccessHash: "", // sem pin
        status: "ACTIVE",
        isSeller: true,
        permitirAcesso: true,
        maxDiscountPercentage: 10 // Vendedor pode dar ate 10%
      }
    });
  } else {
    normalSeller = await prisma.user.update({
      where: { id: normalSeller.id },
      data: { maxDiscountPercentage: 10, status: "ACTIVE" }
    });
  }

  const paymentMethod = await prisma.paymentMethod.findFirst({ where: { companyId: company.id, type: "CASH" } });
  if (!paymentMethod) throw new Error("No CASH payment method found");

  const product = await prisma.product.findFirst({ where: { companyId: company.id } });
  if (!product) throw new Error("No product found");

  const variant = await prisma.productVariant.findFirst({ where: { productId: product.id } });
  if (!variant) throw new Error("No variant found");

  await prisma.productVariant.update({
    where: { id: variant.id },
    data: { availableStock: 100, currentStock: 100 }
  });

  const saleBase = {
    companyId: company.id,
    sellerId: normalSeller.id,
    cashRegisterId: cashRegister.id,
    subtotal: 100,
    items: [{
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
    }]
  };

  // Case 1: Venda com desconto abaixo do limite (sucesso sem PIN)
  console.log("Case 1: Venda com desconto abaixo do limite (sucesso sem PIN)...");
  try {
    const sale1 = await salesService.createSale({
      ...saleBase,
      discountAmount: 5, // 5%
      totalAmount: 95,
      items: [{ ...saleBase.items[0], discount: 5, totalPrice: 95 }],
      payments: [{ paymentMethodId: paymentMethod.id, amount: 95, installments: 1 }]
    });
    console.log("[PASS] Desconto 5% aprovado automaticamente.");
  } catch (e: any) {
    throw new Error("Failed Case 1: " + e.message);
  }

  // Case 2: Venda com desconto igual ao limite (sucesso sem PIN)
  console.log("Case 2: Venda com desconto igual ao limite (sucesso sem PIN)...");
  try {
    const sale2 = await salesService.createSale({
      ...saleBase,
      discountAmount: 10, // 10%
      totalAmount: 90,
      items: [{ ...saleBase.items[0], discount: 10, totalPrice: 90 }],
      payments: [{ paymentMethodId: paymentMethod.id, amount: 90, installments: 1 }]
    });
    console.log("[PASS] Desconto 10% aprovado automaticamente.");
  } catch (e: any) {
    throw new Error("Failed Case 2: " + e.message);
  }

  // Case 3: Venda acima do limite sem autorização bloqueia
  console.log("Case 3: Venda acima do limite sem autorização bloqueia...");
  try {
    await salesService.createSale({
      ...saleBase,
      discountAmount: 15, // 15%
      totalAmount: 85,
      items: [{ ...saleBase.items[0], discount: 15, totalPrice: 85 }],
      payments: [{ paymentMethodId: paymentMethod.id, amount: 85, installments: 1 }]
    });
    throw new Error("Should have thrown error");
  } catch (e: any) {
    if (e.message.includes("excede o limite permitido") || e.message.includes("Autorização de administrador é necessária")) {
      console.log("[PASS] Bloqueio por falta de PIN validado.");
    } else {
      throw e;
    }
  }

  // Case 4: Venda com PIN inválido bloqueia
  console.log("Case 4: Venda com PIN inválido bloqueia...");
  try {
    await salesService.createSale({
      ...saleBase,
      discountAmount: 15, // 15%
      totalAmount: 85,
      items: [{ ...saleBase.items[0], discount: 15, totalPrice: 85 }],
      payments: [{ paymentMethodId: paymentMethod.id, amount: 85, installments: 1 }],
      authPin: "000000" // Wrong pin
    });
    throw new Error("Should have thrown error");
  } catch (e: any) {
    if (e.message.includes("PIN de autorização inválido")) {
      console.log("[PASS] Bloqueio por PIN incorreto validado.");
    } else {
      throw e;
    }
  }

  // Case 5: Venda com PIN válido aprova
  console.log("Case 5: Venda com PIN válido aprova...");
  let saleId = "";
  try {
    const sale5 = await salesService.createSale({
      ...saleBase,
      discountAmount: 15, // 15%
      totalAmount: 85,
      items: [{ ...saleBase.items[0], discount: 15, totalPrice: 85 }],
      payments: [{ paymentMethodId: paymentMethod.id, amount: 85, installments: 1 }],
      authPin: "123456", // Correct pin
      authReason: "Desconto especial de teste"
    });
    saleId = sale5.id;
    console.log("[PASS] Desconto 15% autorizado por PIN com sucesso.");
  } catch (e: any) {
    throw new Error("Failed Case 5: " + e.message);
  }

  // Case 6: SaleAuthorization criada
  console.log("Case 6: SaleAuthorization criada...");
  const auth = await prisma.saleAuthorization.findFirst({ where: { saleId } });
  if (!auth || auth.requestedDiscount.toNumber() !== 15 || auth.authorizedByUserId !== adminUser.id || auth.reason !== "Desconto especial de teste") {
    throw new Error("Sale authorization not created properly");
  }
  console.log("[PASS] SaleAuthorization verificada no banco de dados.");

  // Case 7: ActivityLog criado
  console.log("Case 7: ActivityLog criado...");
  const log = await prisma.activityLog.findFirst({ where: { recordId: saleId, action: "AUTHORIZE_DISCOUNT" } });
  if (!log || log.userId !== adminUser.id) {
    throw new Error("ActivityLog missing or incorrect");
  }
  console.log("[PASS] ActivityLog verificado no banco de dados.");

  console.log("==================================================");
  console.log("ALL PHASE 6F DISCOUNT AUTHORIZATION TESTS PASSED!");
  console.log("==================================================");
  process.exit(0);
}

runTests().catch(e => {
  console.error("\n[FAIL] Error during discount authorization test:");
  console.error(e);
  process.exit(1);
});
