import { PrismaClient } from "@prisma/client";
import { createSaleAction } from "../src/lib/sales/actions/create-sale-action";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting Phase 6E PDV Flow Tests...");

  try {
    const company = await prisma.company.findFirst();
    if (!company) throw new Error("No company found for test.");

    const sellerUser = await prisma.user.findFirst({ where: { companyId: company.id } });
    if (!sellerUser) throw new Error("No user found for test.");

    // Setup Cash Register
    let bankAccount = await prisma.bankAccount.findFirst({ where: { companyId: company.id } });
    if (!bankAccount) {
      bankAccount = await prisma.bankAccount.create({
        data: {
          companyId: company.id,
          name: "Test Bank Account",
          isCashAccount: true,
          currentBalance: 0
        }
      });
    }

    let cashRegister = await prisma.cashRegister.findFirst({ where: { companyId: company.id, status: "OPEN" } });
    if (!cashRegister) {
      cashRegister = await prisma.cashRegister.create({
        data: {
          companyId: company.id,
          openedByUserId: sellerUser.id,
          bankAccountId: bankAccount.id,
          status: "OPEN",
          openingBalance: 100,
          expectedBalance: 100
        }
      });
    }

    // Setup Payment Methods
    const types = ["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD", "STORE_CREDIT", "CUSTOMER_WALLET"];
    const pmIds: any = {};
    for (const t of types) {
      let pm = await prisma.paymentMethod.findFirst({ where: { companyId: company.id, type: t as any } });
      if (!pm) {
        pm = await prisma.paymentMethod.create({
          data: {
            companyId: company.id,
            name: `Test PM ${t}`,
            type: t as any,
            isActive: true
          }
        });
      }
      pmIds[t] = pm.id;
    }

    // Setup Customer & Wallet
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        name: "Test PDV Customer",
        phone: `119${Date.now().toString().slice(-8)}`,
        wallet: {
          create: {
            balance: 50
          }
        }
      },
      include: { wallet: true }
    });

    // Setup Product
    const dummyProduct = await prisma.product.create({
      data: {
        companyId: company.id,
        name: "Test Product PDV",
        internalCode: `TST-PDV-${Date.now()}`
      }
    });

    const variant = await prisma.productVariant.create({
      data: {
        productId: dummyProduct.id,
        name: "Variant PDV",
        sku: `SKU-PDV-${Date.now()}`,
        costPrice: 10,
        salePrice: 20,
        currentStock: 100,
        availableStock: 100
      }
    });

    // ==========================================
    // Test Cases
    // ==========================================

    // Case 13: Rollback por estoque insuficiente
    console.log("Case 13: Rollback por estoque insuficiente...");
    const resFailStock = await createSaleAction({
      companyId: company.id,
      sellerId: sellerUser.id,
      subtotal: 2000,
      totalAmount: 2000,
      discountAmount: 0,
      items: [{
        variantId: variant.id,
        productNameSnapshot: dummyProduct.name,
        variantNameSnapshot: variant.name,
        skuSnapshot: variant.sku,
        quantity: 101, // > 100
        unitPrice: 20,
        discount: 0,
        totalPrice: 2000,
        costPriceAtSale: 10,
        salePriceAtSale: 20,
        marginAtSale: 50
      }],
      payments: [{ paymentMethodId: pmIds["CASH"], amount: 2000 }]
    });
    if (resFailStock.success) throw new Error("Should have failed due to stock!");
    console.log("[PASS] Stock validation works.");

    // Múltiplos Pagamentos (Testando dinheiro, carteira e crediário ao mesmo tempo)
    console.log("Case 7: Múltiplos Pagamentos (Dinheiro + Carteira + Crediário)...");
    const resMultiple = await createSaleAction({
      companyId: company.id,
      sellerId: sellerUser.id,
      customerId: customer.id,
      subtotal: 100,
      totalAmount: 100,
      discountAmount: 0,
      items: [{
        variantId: variant.id,
        productNameSnapshot: dummyProduct.name,
        variantNameSnapshot: variant.name,
        skuSnapshot: variant.sku,
        quantity: 5,
        unitPrice: 20,
        discount: 0,
        totalPrice: 100,
        costPriceAtSale: 10,
        salePriceAtSale: 20,
        marginAtSale: 50
      }],
      payments: [
        { paymentMethodId: pmIds["CASH"], amount: 30, installments: 1 },
        { paymentMethodId: pmIds["CUSTOMER_WALLET"], amount: 30 },
        { paymentMethodId: pmIds["STORE_CREDIT"], amount: 40 }
      ]
    });

    if (!resMultiple.success) throw new Error("Failed multiple payments: " + resMultiple.error);
    const saleId = (resMultiple.sale as any).id;
    console.log("[PASS] Multiple payments processed.");

    // Validate Financial Transactions
    console.log("Case 9: Financeiro criado...");
    const finTxs = await prisma.financialTransaction.findMany({ where: { referenceId: saleId } });
    if (finTxs.length !== 2) throw new Error(`Expected 2 financial transactions, found ${finTxs.length}`);
    console.log("[PASS] Financial transactions created correctly.");

    // Validate Cash Update
    console.log("Case 10: Caixa atualizado...");
    const updatedRegister = await prisma.cashRegister.findUnique({ where: { id: cashRegister.id } });
    const expectedNewBalance = cashRegister.expectedBalance.toNumber() + 30;
    if (updatedRegister?.expectedBalance.toNumber() !== expectedNewBalance) throw new Error(`Cash register balance not updated correctly. Expected ${expectedNewBalance}, got ${updatedRegister?.expectedBalance.toNumber()}`);
    
    const cashMovements = await prisma.cashMovement.findMany({ where: { description: `Venda #${saleId}` } });
    if (cashMovements.length !== 1) throw new Error("Cash movement not created");
    console.log("[PASS] Cash register updated correctly.");

    // Validate Accounts Receivable (Crediário)
    console.log("Case 5: Venda Crediário (Contas a Receber)...");
    const receivables = await prisma.accountsReceivable.findMany({ where: { customerId: customer.id } });
    if (receivables.length !== 1 || receivables[0].originalAmount.toNumber() !== 40) throw new Error("Accounts receivable not created correctly.");
    console.log("[PASS] Crediário processed correctly.");

    // Validate Wallet Update
    console.log("Case 6: Venda Carteira Cliente...");
    const updatedWallet = await prisma.customerWallet.findUnique({ where: { customerId: customer.id } });
    if (updatedWallet?.balance.toNumber() !== 20) throw new Error("Wallet balance not updated correctly (50 - 30)");
    const walletMovements = await prisma.customerWalletMovement.findMany({ where: { walletId: customer.wallet!.id } });
    if (walletMovements.length !== 1) throw new Error("Wallet movement not created");
    console.log("[PASS] Customer wallet processed correctly.");

    // Validate Stock
    console.log("Case 8: Estoque atualizado...");
    const updatedVariant = await prisma.productVariant.findUnique({ where: { id: variant.id } });
    if (updatedVariant?.availableStock.toNumber() !== 95) throw new Error("Stock not updated correctly (100 - 5)");
    console.log("[PASS] Stock updated correctly.");

    // Cleanup
    await prisma.customerWalletMovement.deleteMany({ where: { walletId: customer.wallet!.id } });
    await prisma.customerWallet.deleteMany({ where: { customerId: customer.id } });
    await prisma.accountsReceivable.deleteMany({ where: { customerId: customer.id } });
    await prisma.financialTransaction.deleteMany({ where: { referenceId: saleId } });
    await prisma.cashMovement.deleteMany({ where: { cashRegisterId: cashRegister.id } });
    await prisma.sellerCommission.deleteMany({ where: { saleId: saleId } });
    await prisma.sale.delete({ where: { id: saleId } });
    await prisma.productVariant.delete({ where: { id: variant.id } });
    await prisma.product.delete({ where: { id: dummyProduct.id } });
    await prisma.customer.delete({ where: { id: customer.id } });

    console.log("==================================================");
    console.log("ALL PHASE 6E PDV FLOW TESTS PASSED!");
    console.log("==================================================");

  } catch (error) {
    console.error("[FAIL] Error during PDV flow test:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
