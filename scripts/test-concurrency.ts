// Set test environment variable before any imports
process.env.TEST_MODE = 'true';

import { PrismaClient } from "@prisma/client";
import { salesService } from "../src/lib/sales/sales-service";
import { customerWalletService } from "../src/lib/wallet/customer-wallet-service";
import { openCashRegister, closeCashRegister } from "../src/lib/financial/cash-register-service";

const prisma = new PrismaClient();

async function runConcurrencyTests() {
  console.log("==================================================");
  console.log("STARTING CONCURRENCY & LOCKING VALIDATIONS");
  console.log("==================================================");

  // 1. Setup Base Data
  const company = await prisma.company.findFirst();
  if (!company) throw new Error("No company found in database.");

  let user = await prisma.user.findFirst({
    where: { companyId: company.id, role: { isAdmin: true }, status: "ACTIVE", permitirAcesso: true },
    include: { role: true }
  });

  let createdRole: any = null;
  let originalRoleId: string | null = null;
  let targetUser: any = user;

  if (!user) {
    const anyUser = await prisma.user.findFirst({
      where: { companyId: company.id, status: "ACTIVE", permitirAcesso: true }
    });
    if (!anyUser) throw new Error("No active user found in database.");

    let adminRole = await prisma.role.findFirst({
      where: { companyId: company.id, isAdmin: true }
    });
    if (!adminRole) {
      adminRole = await prisma.role.create({
        data: {
          companyId: company.id,
          name: "Admin Concurrency Test",
          isAdmin: true
        }
      });
      createdRole = adminRole;
    }

    originalRoleId = anyUser.roleId;
    targetUser = await prisma.user.update({
      where: { id: anyUser.id },
      data: { roleId: adminRole.id },
      include: { role: true }
    });
    user = targetUser;
  }

  // Salvar e ajustar configurações operacionais temporariamente para testes de cancelamento
  const originalSettings = await prisma.operationalSettings.findUnique({
    where: { companyId: company.id }
  });
  let createdSettings = false;

  await prisma.operationalSettings.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      requireAuthorizationToCancelSale: false,
      cancellationTimeLimit: 9999,
      allowSaleCancellation: true,
      allowNegativeStock: false
    },
    update: {
      requireAuthorizationToCancelSale: false,
      cancellationTimeLimit: 9999,
      allowSaleCancellation: true,
      allowNegativeStock: false
    }
  });
  if (!originalSettings) {
    createdSettings = true;
  }

  let seller = await prisma.seller.findUnique({ where: { id: user.id } });
  let createdSeller = false;
  if (!seller) {
    seller = await prisma.seller.create({
      data: {
        id: user.id,
        companyId: company.id,
        name: "Vendedor Teste Concorrencia",
        status: "ACTIVE"
      }
    });
    createdSeller = true;
  }

  // Mock Session globally for CashRegister operations
  (global as any).mockSession = {
    userId: user.id,
    companyId: company.id,
    name: user.name,
    email: user.email,
    role: 'Administrador',
    isAdmin: true,
    permissions: {},
  };

  let bankAccount = await prisma.bankAccount.findFirst({ where: { companyId: company.id, isActive: true } });
  let createdBankAccount = false;
  if (!bankAccount) {
    bankAccount = await prisma.bankAccount.create({
      data: {
        companyId: company.id,
        name: "Concurrency Test Bank",
        isCashAccount: true,
        currentBalance: 0
      }
    });
    createdBankAccount = true;
  }

  // Setup Payment Method
  let pm = await prisma.paymentMethod.findFirst({ where: { companyId: company.id, type: "CASH" } });
  if (!pm) {
    pm = await prisma.paymentMethod.create({
      data: {
        companyId: company.id,
        name: "Dinheiro Concorrente",
        type: "CASH",
        isActive: true
      }
    });
  }

  let pmWallet = await prisma.paymentMethod.findFirst({ where: { companyId: company.id, type: "CUSTOMER_WALLET" } });
  if (!pmWallet) {
    pmWallet = await prisma.paymentMethod.create({
      data: {
        companyId: company.id,
        name: "Carteira Concorrente",
        type: "CUSTOMER_WALLET",
        isActive: true
      }
    });
  }

  // Setup Customer
  const customer = await prisma.customer.create({
    data: {
      companyId: company.id,
      name: "Customer Concurrency Test",
      phone: `119${Date.now().toString().slice(-8)}`,
      wallet: {
        create: { balance: 100 }
      }
    },
    include: { wallet: true }
  });

  // Setup Product & Variant (Stock = 5)
  const product = await prisma.product.create({
    data: {
      companyId: company.id,
      name: "Product Concurrency Test",
      internalCode: `CONC-${Date.now()}`
    }
  });

  const variant = await prisma.productVariant.create({
    data: {
      companyId: company.id,
      productId: product.id,
      name: "Variant Concurrency Test",
      sku: `SKU-CONC-${Date.now()}`,
      costPrice: 10,
      salePrice: 20,
      currentStock: 5,
      availableStock: 5
    }
  });

  // Clean any active open cash registers to test opening
  await prisma.cashRegister.updateMany({
    where: { companyId: company.id, status: "OPEN" },
    data: { status: "CLOSED", closedAt: new Date() }
  });

  console.log("Setup complete. Initializing test scenarios...\n");

  // ===========================================================================
  // TEST 1: Abertura simultânea de caixa (Devem falhar em duplicados)
  // ===========================================================================
  console.log("TEST 1: Concurrent opening of cash registers for company...");
  const openPromises = [
    openCashRegister({ bankAccountId: bankAccount.id, openingBalance: 100 }),
    openCashRegister({ bankAccountId: bankAccount.id, openingBalance: 150 })
  ];
  const openResults = await Promise.all(openPromises);
  const successOpenCount = openResults.filter(r => r.success).length;

  if (successOpenCount !== 1) {
    console.error(`[FAIL] Expected exactly 1 open register to succeed, got ${successOpenCount}`);
    console.error("Results:", openResults);
    process.exit(1);
  }
  const openedRegister = openResults.find(r => r.success)!.data;
  console.log(`[PASS] Only one cash register opened successfully: ${openedRegister.id}\n`);

  // ===========================================================================
  // TEST 2: Venda simultânea do mesmo produto (Estoque = 5, tentamos vender 3 + 3 = 6)
  // ===========================================================================
  console.log("TEST 2: Two registers selling the same product concurrently (Stock = 5, requests = 3 + 3)...");
  const saleInput1 = {
    companyId: company.id,
    sellerId: seller.id,
    customerId: customer.id,
    cashRegisterId: openedRegister.id,
    subtotal: 60,
    totalAmount: 60,
    discountAmount: 0,
    items: [{
      variantId: variant.id,
      productNameSnapshot: product.name,
      variantNameSnapshot: variant.name,
      skuSnapshot: variant.sku,
      quantity: 3,
      unitPrice: 20,
      discount: 0,
      totalPrice: 60,
      costPriceAtSale: 10,
      salePriceAtSale: 20,
      marginAtSale: 50
    }],
    payments: [{ paymentMethodId: pm.id, amount: 60 }]
  };

  const saleInput2 = {
    ...saleInput1,
    items: [{
      ...saleInput1.items[0],
      quantity: 3
    }]
  };

  const salePromises = [
    salesService.createSale(saleInput1, user.id),
    salesService.createSale(saleInput2, user.id)
  ];

  const saleResults = await Promise.allSettled(salePromises);
  const fulfilledSales = saleResults.filter(r => r.status === "fulfilled");

  // Apenas uma venda deve ser concretizada, a outra deve falhar por estoque insuficiente (3 + 3 = 6 > 5)
  if (fulfilledSales.length !== 1) {
    console.error(`[FAIL] Expected exactly 1 sale to succeed, but ${fulfilledSales.length} succeeded.`);
    console.error("Results:", saleResults);
    process.exit(1);
  }

  const activeSale = (fulfilledSales[0] as PromiseFulfilledResult<any>).value;
  console.log(`[PASS] Only one sale succeeded (Sale ID: ${activeSale.id}). The other failed safely due to stock locking.`);

  // Verificar estoque final (deve ser exatamente 5 - 3 = 2)
  const variantAfter = await prisma.productVariant.findUnique({ where: { id: variant.id } });
  if (variantAfter?.availableStock.toNumber() !== 2) {
    console.error(`[FAIL] Stock level is inconsistent: expected 2, got ${variantAfter?.availableStock.toNumber()}`);
    process.exit(1);
  }
  console.log(`[PASS] Stock level is correct: ${variantAfter?.availableStock.toNumber()}\n`);

  // ===========================================================================
  // TEST 3: Uso simultâneo de saldo de carteira (Saldo = 100, tentamos debitar 60 + 60 = 120)
  // ===========================================================================
  console.log("TEST 3: Concurrent use of the same wallet (Balance = 100, requests = 60 + 60)...");
  const walletPromises = [
    customerWalletService.debitWallet({ customerId: customer.id, amount: 60, type: "DEBIT" }),
    customerWalletService.debitWallet({ customerId: customer.id, amount: 60, type: "DEBIT" })
  ];

  const walletResults = await Promise.allSettled(walletPromises);
  const fulfilledWallets = walletResults.filter(r => r.status === "fulfilled");

  // Apenas um débito deve ter sucesso, outro deve lançar saldo insuficiente
  if (fulfilledWallets.length !== 1) {
    console.error(`[FAIL] Expected exactly 1 wallet debit to succeed, but ${fulfilledWallets.length} succeeded.`);
    console.error("Results:", walletResults);
    process.exit(1);
  }
  console.log(`[PASS] Only one wallet debit succeeded. The other was safely blocked by balance checks under locking.`);

  // Verificar saldo final da carteira (deve ser exatamente 100 - 60 = 40)
  const walletAfter = await prisma.customerWallet.findUnique({ where: { customerId: customer.id } });
  if (walletAfter?.balance.toNumber() !== 40) {
    console.error(`[FAIL] Wallet balance is inconsistent: expected 40, got ${walletAfter?.balance.toNumber()}`);
    process.exit(1);
  }
  console.log(`[PASS] Wallet balance is correct: ${walletAfter?.balance.toNumber()}\n`);

  // ===========================================================================
  // TEST 4: Fechamento simultâneo de caixa (Deve fechar apenas uma vez)
  // ===========================================================================
  console.log("TEST 4: Concurrent closing of the same cash register...");
  const closePromises = [
    closeCashRegister(openedRegister.id, { closingBalance: 160 }),
    closeCashRegister(openedRegister.id, { closingBalance: 160 })
  ];
  const closeResults = await Promise.all(closePromises);
  const successCloseCount = closeResults.filter(r => r.success).length;

  if (successCloseCount !== 1) {
    console.error(`[FAIL] Expected exactly 1 close register operation to succeed, got ${successCloseCount}`);
    console.error("Results:", closeResults);
    process.exit(1);
  }
  console.log(`[PASS] Only one closing call succeeded. The other was blocked because register was already closed.\n`);

  // ===========================================================================
  // TEST 5: Cancelamento simultâneo de venda (Deve estornar estoque/carteira uma única vez)
  // ===========================================================================
  console.log("TEST 5: Concurrent cancellation of the same sale...");
  const cancelPromises = [
    salesService.cancelSale({ saleId: activeSale.id, cancelReason: "Cancel 1", cancelledByUserId: user.id }),
    salesService.cancelSale({ saleId: activeSale.id, cancelReason: "Cancel 2", cancelledByUserId: user.id })
  ];

  const cancelResults = await Promise.allSettled(cancelPromises);
  const fulfilledCancels = cancelResults.filter(r => r.status === "fulfilled");

  if (fulfilledCancels.length !== 1) {
    console.error(`[FAIL] Expected exactly 1 cancel operation to succeed, but ${fulfilledCancels.length} succeeded.`);
    console.error("Results:", cancelResults);
    process.exit(1);
  }
  console.log(`[PASS] Only one cancellation call succeeded. The other was blocked because sale was already cancelled.`);

  // Verificar estoque final estornado (deve ter retornado 3 unidades, voltando de 2 para 5)
  const variantFinal = await prisma.productVariant.findUnique({ where: { id: variant.id } });
  if (variantFinal?.availableStock.toNumber() !== 5) {
    console.error(`[FAIL] Stock not restored correctly: expected 5, got ${variantFinal?.availableStock.toNumber()}`);
    process.exit(1);
  }
  console.log(`[PASS] Stock restored correctly to: ${variantFinal?.availableStock.toNumber()}`);

  // Verificar carteira estornada (não usou carteira no pagamento, então deve continuar com 40)
  const walletFinal = await prisma.customerWallet.findUnique({ where: { customerId: customer.id } });
  if (walletFinal?.balance.toNumber() !== 40) {
    console.error(`[FAIL] Wallet balance changed unexpectedly: expected 40, got ${walletFinal?.balance.toNumber()}`);
    process.exit(1);
  }
  console.log(`[PASS] Wallet balance remains correct: ${walletFinal?.balance.toNumber()}\n`);

  // ===========================================================================
  // CLEANUP
  // ===========================================================================
  console.log("Cleaning up database test records...");
  await prisma.customerWalletMovement.deleteMany({ where: { walletId: customer.wallet!.id } });
  await prisma.customerWallet.deleteMany({ where: { customerId: customer.id } });
  await prisma.accountsReceivable.deleteMany({ where: { customerId: customer.id } });
  await prisma.financialTransaction.deleteMany({ where: { referenceId: activeSale.id } });
  await prisma.cashMovement.deleteMany({ where: { cashRegisterId: openedRegister.id } });
  await prisma.cashRegister.delete({ where: { id: openedRegister.id } });
  await prisma.sellerCommission.deleteMany({ where: { saleId: activeSale.id } });
  await prisma.sale.delete({ where: { id: activeSale.id } });
  await prisma.productVariant.delete({ where: { id: variant.id } });
  await prisma.product.delete({ where: { id: product.id } });
  await prisma.customer.delete({ where: { id: customer.id } });
  if (createdSeller && seller) {
    await prisma.seller.delete({ where: { id: seller.id } });
  }
  await prisma.paymentMethod.deleteMany({ where: { name: { in: ["Dinheiro Concorrente", "Carteira Concorrente"] } } });
  if (createdBankAccount && bankAccount) {
    await prisma.bankAccount.delete({ where: { id: bankAccount.id } });
  }

  // Restaurar papel original do usuário
  if (originalRoleId !== null && targetUser) {
    await prisma.user.update({
      where: { id: targetUser.id },
      data: { roleId: originalRoleId }
    });
  }
  if (createdRole) {
    await prisma.role.delete({ where: { id: createdRole.id } });
  }

  // Restaurar configurações operacionais
  if (originalSettings) {
    await prisma.operationalSettings.update({
      where: { companyId: company.id },
      data: {
        requireAuthorizationToCancelSale: originalSettings.requireAuthorizationToCancelSale,
        cancellationTimeLimit: originalSettings.cancellationTimeLimit,
        allowSaleCancellation: originalSettings.allowSaleCancellation,
        allowNegativeStock: originalSettings.allowNegativeStock
      }
    });
  } else if (createdSettings) {
    await prisma.operationalSettings.delete({ where: { companyId: company.id } });
  }

  console.log("==================================================");
  console.log("ALL CONCURRENCY TESTS PASSED SUCCESSFULLY!");
  console.log("No deadlocks, duplicate open cash registers, or stock leaks were detected.");
  console.log("==================================================");
}

runConcurrencyTests()
  .catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
