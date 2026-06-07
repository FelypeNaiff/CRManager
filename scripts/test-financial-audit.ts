// Set test environment variable before any imports
process.env.TEST_MODE = 'true';

import { PrismaClient } from "@prisma/client";
import { salesService } from "../src/lib/sales/sales-service";
import { customerWalletService } from "../src/lib/wallet/customer-wallet-service";
import { receivablesService } from "../src/lib/financial/receivables-service";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

async function runFinancialAuditTests() {
  console.log("==================================================");
  console.log("STARTING HARDENING-04 FINANCIAL AUDIT SUITE");
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
          name: "Admin Audit Test",
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

  // Setup Seller (associated with user.id to pass foreign keys)
  let seller = await prisma.seller.findUnique({ where: { id: user.id } });
  let createdSeller = false;
  if (!seller) {
    seller = await prisma.seller.create({
      data: {
        id: user.id,
        companyId: company.id,
        name: "Audit Seller",
        commissionRate: 5.0, // 5% comissão
        status: "ACTIVE"
      }
    });
    createdSeller = true;
  }

  // Setup Operational Settings
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
      allowNegativeStock: false,
      enableCommissions: true,
      defaultCommissionRate: 5.0
    },
    update: {
      requireAuthorizationToCancelSale: false,
      cancellationTimeLimit: 9999,
      allowSaleCancellation: true,
      allowNegativeStock: false,
      enableCommissions: true,
      defaultCommissionRate: 5.0
    }
  });
  if (!originalSettings) {
    createdSettings = true;
  }

  // Mock Session globally
  (global as any).mockSession = {
    userId: user.id,
    companyId: company.id,
    name: user.name,
    email: user.email,
    role: 'Administrador',
    isAdmin: true,
    permissions: {},
  };

  // Setup Bank Account
  let bankAccount = await prisma.bankAccount.findFirst({ where: { companyId: company.id, isActive: true } });
  let createdBankAccount = false;
  if (!bankAccount) {
    bankAccount = await prisma.bankAccount.create({
      data: {
        companyId: company.id,
        name: "Audit Test Bank",
        isCashAccount: true,
        currentBalance: 0
      }
    });
    createdBankAccount = true;
  }

  // Setup Cash Register
  let openedRegister = await prisma.cashRegister.findFirst({
    where: { companyId: company.id, status: "OPEN" }
  });
  let createdRegister = false;
  if (!openedRegister) {
    openedRegister = await prisma.cashRegister.create({
      data: {
        companyId: company.id,
        openedByUserId: user.id,
        bankAccountId: bankAccount.id,
        openingBalance: 100,
        expectedBalance: 100,
        status: "OPEN"
      }
    });
    createdRegister = true;
  }

  // Setup Payment Methods
  const pmTypes = ["PIX", "CREDIT_CARD", "CUSTOMER_WALLET"];
  const pmMap: Record<string, string> = {};
  for (const type of pmTypes) {
    let pm = await prisma.paymentMethod.findFirst({ where: { companyId: company.id, type: type as any } });
    if (!pm) {
      pm = await prisma.paymentMethod.create({
        data: {
          companyId: company.id,
          name: `Audit PM ${type}`,
          type: type as any,
          isActive: true,
          settlementDays: type === "CREDIT_CARD" ? 30 : 0
        }
      });
    }
    pmMap[type] = pm.id;
  }

  // Setup Customer & Wallet
  const customer = await prisma.customer.create({
    data: {
      companyId: company.id,
      name: "Customer Audit Test",
      phone: `119${Date.now().toString().slice(-8)}`,
      wallet: {
        create: { balance: 0 }
      }
    },
    include: { wallet: true }
  });

  // Setup Product & Variant
  const product = await prisma.product.create({
    data: {
      companyId: company.id,
      name: "Product Audit Test",
      internalCode: `AUDIT-${Date.now()}`
    }
  });

  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      companyId: company.id,
      name: "Variant Audit Test",
      sku: `SKU-AUDIT-${Date.now()}`,
      costPrice: 10,
      salePrice: 20,
      currentStock: 10,
      availableStock: 10
    }
  });

  console.log("Setup completed successfully. Starting audit verification cases...\n");

  const createdSaleIds: string[] = [];

  // ===========================================================================
  // CASE 1: Venda PIX (Liquidação Imediata)
  // ===========================================================================
  console.log("CASE 1: PIX Sale (Immediate Settlement)...");
  const salePix = await salesService.createSale({
    companyId: company.id,
    sellerId: seller.id,
    customerId: customer.id,
    cashRegisterId: openedRegister.id,
    subtotal: 40,
    totalAmount: 40,
    discountAmount: 0,
    items: [{
      variantId: variant.id,
      productNameSnapshot: product.name,
      variantNameSnapshot: variant.name,
      skuSnapshot: variant.sku,
      quantity: 2,
      unitPrice: 20,
      discount: 0,
      totalPrice: 40,
      costPriceAtSale: 10,
      salePriceAtSale: 20,
      marginAtSale: 50
    }],
    payments: [{ paymentMethodId: pmMap["PIX"], amount: 40 }]
  }, user.id) as any;

  if (!salePix.id) throw new Error("Failed to create PIX sale.");
  createdSaleIds.push(salePix.id);

  // Verificações
  // A. Estoque (10 - 2 = 8)
  const v1 = await prisma.productVariant.findUnique({ where: { id: variant.id } });
  if (v1?.availableStock.toNumber() !== 8) throw new Error(`Stock mismatch. Expected 8, got ${v1?.availableStock}`);
  console.log("  [PASS] Stock correctly decremented to 8.");

  // B. Recebível (Gera 1 recebível com status PAID e originalAmount 40)
  const recPix = await prisma.accountsReceivable.findFirst({ where: { originalAmount: 40, customerId: customer.id } });
  if (!recPix || recPix.status !== "PAID" || recPix.remainingAmount.toNumber() !== 0) {
    throw new Error(`Receivable logic failed for PIX sale: ${JSON.stringify(recPix)}`);
  }
  console.log("  [PASS] Paid receivable generated correctly.");

  // C. Transação Financeira (Gera 1 transação INCOME PAID de 40)
  const finPix = await prisma.financialTransaction.findFirst({ where: { referenceId: salePix.id, type: "INCOME" } });
  if (!finPix || finPix.status !== "PAID" || finPix.amount.toNumber() !== 40) {
    throw new Error(`Financial transaction logic failed for PIX sale: ${JSON.stringify(finPix)}`);
  }
  console.log("  [PASS] Financial transaction generated as PAID.");

  // D. Comissão (Vendedor ganha comissão de 5% sobre 40 = R$ 2)
  const commPix = await prisma.sellerCommission.findFirst({ where: { saleId: salePix.id } });
  if (!commPix || commPix.amount.toNumber() !== 2) {
    throw new Error(`Commission amount mismatch. Expected 2, got ${commPix?.amount}`);
  }
  console.log("  [PASS] Seller commission processed correctly (R$ 2.00).\n");

  // ===========================================================================
  // CASE 2: Venda Crédito Parcelado (A Prazo / 2 Parcelas)
  // ===========================================================================
  console.log("CASE 2: Credit Card Sale (2 Installments)...");
  const saleCredit = await salesService.createSale({
    companyId: company.id,
    sellerId: seller.id,
    customerId: customer.id,
    cashRegisterId: openedRegister.id,
    subtotal: 20,
    totalAmount: 20,
    discountAmount: 0,
    items: [{
      variantId: variant.id,
      productNameSnapshot: product.name,
      variantNameSnapshot: variant.name,
      skuSnapshot: variant.sku,
      quantity: 1,
      unitPrice: 20,
      discount: 0,
      totalPrice: 20,
      costPriceAtSale: 10,
      salePriceAtSale: 20,
      marginAtSale: 50
    }],
    payments: [{ paymentMethodId: pmMap["CREDIT_CARD"], amount: 20, installments: 2 }]
  }, user.id) as any;

  if (!saleCredit.id) throw new Error("Failed to create credit card sale.");
  createdSaleIds.push(saleCredit.id);

  // Verificações
  // A. Estoque (8 - 1 = 7)
  const v2 = await prisma.productVariant.findUnique({ where: { id: variant.id } });
  if (v2?.availableStock.toNumber() !== 7) throw new Error(`Stock mismatch. Expected 7, got ${v2?.availableStock}`);
  console.log("  [PASS] Stock correctly decremented to 7.");

  // B. Recebíveis (Gera 2 recebíveis de R$ 10 cada com status PENDING)
  const recCredits = await prisma.accountsReceivable.findMany({
    where: { originalAmount: 10, customerId: customer.id, status: "PENDING" }
  });
  if (recCredits.length !== 2) {
    throw new Error(`Expected 2 pending receivables, found ${recCredits.length}`);
  }
  console.log("  [PASS] 2 pending receivables created correctly.");

  // C. Transações Financeiras (Gera 2 transações PENDING de 10)
  const finCredits = await prisma.financialTransaction.findMany({
    where: { referenceId: saleCredit.id, status: "PENDING" }
  });
  if (finCredits.length !== 2) {
    throw new Error(`Expected 2 pending financial transactions, found ${finCredits.length}`);
  }
  console.log("  [PASS] 2 pending financial transactions created correctly.\n");

  // ===========================================================================
  // CASE 3: Baixa Manual de Recebível
  // ===========================================================================
  console.log("CASE 3: Settle Receivable manually...");
  const targetReceivable = recCredits[0];
  await prisma.$transaction(async (tx) => {
    await receivablesService.settleReceivable(targetReceivable.id, new Date(), user.id, tx);
  });

  // Verificações
  // A. Status do Recebível alterado para PAID, remainingAmount = 0
  const recSettle = await prisma.accountsReceivable.findUnique({ where: { id: targetReceivable.id } });
  if (!recSettle || recSettle.status !== "PAID" || recSettle.remainingAmount.toNumber() !== 0) {
    throw new Error(`Receivable settlement failed: ${JSON.stringify(recSettle)}`);
  }
  console.log("  [PASS] Accounts receivable correctly settled to PAID.");

  // B. Transação Financeira correspondente alterada para PAID
  const finSettle = await prisma.financialTransaction.findUnique({ where: { id: targetReceivable.financialTransactionId! } });
  if (!finSettle || finSettle.status !== "PAID") {
    throw new Error(`Financial transaction settlement failed: ${JSON.stringify(finSettle)}`);
  }
  console.log("  [PASS] Financial transaction correctly updated to PAID.\n");

  // ===========================================================================
  // CASE 4: Venda com Saldo da Carteira (Wallet)
  // ===========================================================================
  console.log("CASE 4: Customer Wallet Sale...");
  // Creditar carteira com R$ 50 primeiro
  await customerWalletService.creditWallet({
    customerId: customer.id,
    amount: 50,
    type: "CREDIT",
    description: "Carga de teste auditoria",
    createdById: user.id
  });

  const saleWallet = await salesService.createSale({
    companyId: company.id,
    sellerId: seller.id,
    customerId: customer.id,
    cashRegisterId: openedRegister.id,
    subtotal: 40,
    totalAmount: 40,
    discountAmount: 0,
    items: [{
      variantId: variant.id,
      productNameSnapshot: product.name,
      variantNameSnapshot: variant.name,
      skuSnapshot: variant.sku,
      quantity: 2,
      unitPrice: 20,
      discount: 0,
      totalPrice: 40,
      costPriceAtSale: 10,
      salePriceAtSale: 20,
      marginAtSale: 50
    }],
    payments: [{ paymentMethodId: pmMap["CUSTOMER_WALLET"], amount: 40 }]
  }, user.id) as any;

  if (!saleWallet.id) throw new Error("Failed to create wallet sale.");
  createdSaleIds.push(saleWallet.id);

  // Verificações
  // A. Estoque (7 - 2 = 5)
  const v3 = await prisma.productVariant.findUnique({ where: { id: variant.id } });
  if (v3?.availableStock.toNumber() !== 5) throw new Error(`Stock mismatch. Expected 5, got ${v3?.availableStock}`);
  console.log("  [PASS] Stock correctly decremented to 5.");

  // B. Saldo da Carteira (50 - 40 = 10)
  const walletAfter = await prisma.customerWallet.findUnique({ where: { customerId: customer.id } });
  if (walletAfter?.balance.toNumber() !== 10) throw new Error(`Wallet balance mismatch. Expected 10, got ${walletAfter?.balance}`);
  console.log("  [PASS] Customer wallet balance correctly updated to R$ 10.00.");

  // C. Movimentação da Carteira (Gera WalletTransaction DEBIT de 40)
  const walletTx = await prisma.walletTransaction.findFirst({ where: { saleId: saleWallet.id, type: "DEBIT" } });
  if (!walletTx || walletTx.amount.toNumber() !== 40) {
    throw new Error(`Wallet transaction failed: ${JSON.stringify(walletTx)}`);
  }
  console.log("  [PASS] Wallet transaction DEBIT logged correctly.\n");

  // ===========================================================================
  // CASE 5: Cancelamento de Venda com Estorno de Carteira
  // ===========================================================================
  console.log("CASE 5: Cancel Wallet Sale & Verify Refund...");
  await salesService.cancelSale({
    saleId: saleWallet.id,
    cancelReason: "Cliente devolveu os produtos",
    cancelledByUserId: user.id
  });

  // Verificações
  // A. Venda marcada como CANCELLED
  const cancelledSale = await prisma.sale.findUnique({ where: { id: saleWallet.id } });
  if (cancelledSale?.status !== "CANCELLED") throw new Error("Sale status was not updated to CANCELLED.");
  console.log("  [PASS] Sale status is CANCELLED.");

  // B. Estoque devolvido (5 + 2 = 7)
  const v4 = await prisma.productVariant.findUnique({ where: { id: variant.id } });
  if (v4?.availableStock.toNumber() !== 7) throw new Error(`Stock not restored. Expected 7, got ${v4?.availableStock}`);
  console.log("  [PASS] Stock correctly restored to 7.");

  // C. Saldo Carteira estornado (10 + 40 = 50)
  const walletFinal = await prisma.customerWallet.findUnique({ where: { customerId: customer.id } });
  if (walletFinal?.balance.toNumber() !== 50) throw new Error(`Wallet balance not refunded. Expected 50, got ${walletFinal?.balance}`);
  console.log("  [PASS] Wallet balance correctly refunded to R$ 50.00.");

  // D. Movimentação da Carteira (Gera WalletTransaction REFUND de 40)
  const refundTx = await prisma.walletTransaction.findFirst({ where: { saleId: saleWallet.id, type: "REFUND" } });
  if (!refundTx || refundTx.amount.toNumber() !== 40) {
    throw new Error(`Wallet refund transaction failed: ${JSON.stringify(refundTx)}`);
  }
  console.log("  [PASS] Wallet transaction REFUND logged correctly.");

  // E. Comissão (Cancelada ou revertida)
  const commCancel = await prisma.sellerCommission.findFirst({ where: { saleId: saleWallet.id } });
  if (commCancel && commCancel.status !== "CANCELLED") {
    throw new Error(`Commission was not cancelled: ${JSON.stringify(commCancel)}`);
  }
  console.log("  [PASS] Seller commission correctly marked as CANCELLED.\n");

  // ===========================================================================
  // CLEANUP
  // ===========================================================================
  console.log("Cleaning up database audit test records...");
  await prisma.customerWalletMovement.deleteMany({ where: { walletId: customer.wallet!.id } });
  await prisma.walletTransaction.deleteMany({ where: { customerId: customer.id } });
  await prisma.customerWallet.deleteMany({ where: { customerId: customer.id } });
  await prisma.accountsReceivable.deleteMany({ where: { customerId: customer.id } });
  await prisma.financialTransaction.deleteMany({ where: { referenceId: { in: createdSaleIds } } });
  await prisma.cashMovement.deleteMany({ where: { cashRegisterId: openedRegister.id } });
  if (createdRegister) {
    await prisma.cashRegister.delete({ where: { id: openedRegister.id } });
  }
  await prisma.sellerCommission.deleteMany({ where: { saleId: { in: createdSaleIds } } });
  await prisma.sale.deleteMany({ where: { id: { in: createdSaleIds } } });
  await prisma.productVariant.delete({ where: { id: variant.id } });
  await prisma.product.delete({ where: { id: product.id } });
  await prisma.customer.delete({ where: { id: customer.id } });
  if (createdSeller && seller) {
    await prisma.seller.delete({ where: { id: seller.id } });
  }
  if (createdBankAccount && bankAccount) {
    await prisma.bankAccount.delete({ where: { id: bankAccount.id } });
  }

  // Restaurar configurações operacionais
  if (originalSettings) {
    await prisma.operationalSettings.update({
      where: { companyId: company.id },
      data: {
        requireAuthorizationToCancelSale: originalSettings.requireAuthorizationToCancelSale,
        cancellationTimeLimit: originalSettings.cancellationTimeLimit,
        allowSaleCancellation: originalSettings.allowSaleCancellation,
        allowNegativeStock: originalSettings.allowNegativeStock,
        enableCommissions: originalSettings.enableCommissions,
        defaultCommissionRate: originalSettings.defaultCommissionRate
      }
    });
  } else if (createdSettings) {
    await prisma.operationalSettings.delete({ where: { companyId: company.id } });
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

  console.log("==================================================");
  console.log("ALL FINANCIAL AUDIT TESTS PASSED SUCCESSFULLY!");
  console.log("Full lifecycle consistency validated: Sale -> Stock -> Receivables -> Ledger -> Commission -> Wallet -> Rollbacks.");
  console.log("==================================================");
}

runFinancialAuditTests()
  .catch(err => {
    console.error("Audit suite execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
