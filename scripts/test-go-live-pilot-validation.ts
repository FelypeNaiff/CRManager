import { PrismaClient, PaymentMethodType, SaleStatus } from "@prisma/client";
import { SalesService } from "../src/lib/sales/sales-service";

const prisma = new PrismaClient();
const salesService = new SalesService();

async function runPilotValidationTest() {
  console.log("==================================================");
  console.log("STARTING GO-LIVE PILOT VALIDATION TESTS");
  console.log("==================================================");

  const company = await prisma.company.findFirst();
  if (!company) {
    console.error("  [FAIL] No company found in database. Run seeding first.");
    process.exit(1);
  }

  const activeUser = await prisma.user.findFirst({
    where: { companyId: company.id, status: "ACTIVE" }
  });
  if (!activeUser) {
    console.error("  [FAIL] No active user found.");
    process.exit(1);
  }

  const seller = await prisma.seller.findFirst({
    where: { companyId: company.id, status: "ACTIVE" }
  });
  if (!seller) {
    console.error("  [FAIL] No active seller found.");
    process.exit(1);
  }

  // Ensure Cash Register is open
  let cashAccount = await prisma.bankAccount.findFirst({
    where: { companyId: company.id, isCashAccount: true }
  });
  if (!cashAccount) {
    cashAccount = await prisma.bankAccount.create({
      data: {
        companyId: company.id,
        name: "Caixa Piloto Teste",
        isCashAccount: true,
        initialBalance: 500,
        currentBalance: 500,
        isActive: true
      }
    });
  }

  let cashRegister = await prisma.cashRegister.findFirst({
    where: { companyId: company.id, status: "OPEN" }
  });
  if (!cashRegister) {
    cashRegister = await prisma.cashRegister.create({
      data: {
        companyId: company.id,
        openedByUserId: activeUser.id,
        bankAccountId: cashAccount.id,
        status: "OPEN",
        openingBalance: 500,
        expectedBalance: 500
      }
    });
  }

  // Ensure Payment Methods exist
  let pmPix = await prisma.paymentMethod.findFirst({
    where: { companyId: company.id, type: PaymentMethodType.PIX }
  });
  if (!pmPix) {
    pmPix = await prisma.paymentMethod.create({
      data: {
        companyId: company.id,
        name: "PIX Piloto",
        type: PaymentMethodType.PIX,
        isActive: true
      }
    });
  }

  // Ensure settings allow cancellation without authorization for this test run
  await prisma.operationalSettings.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      requireAuthorizationToCancelSale: false,
      allowSaleCancellation: true,
      cancellationTimeLimit: 9999
    },
    update: {
      requireAuthorizationToCancelSale: false,
      allowSaleCancellation: true,
      cancellationTimeLimit: 9999
    }
  });

  // 1. Create a product with barcode
  const prodA = await prisma.product.create({
    data: {
      companyId: company.id,
      name: "Produto Teste Com Barcode",
      internalCode: `PILOT-A-${Date.now()}`
    }
  });

  const variantWithBarcode = await prisma.productVariant.create({
    data: {
      companyId: company.id,
      productId: prodA.id,
      name: "Único",
      sku: `SKU-PILOT-A-${Date.now()}`,
      barcode: "7891234567890",
      costPrice: 10,
      salePrice: 25,
      currentStock: 10,
      availableStock: 10
    }
  });

  // 2. Create a product without barcode
  const prodB = await prisma.product.create({
    data: {
      companyId: company.id,
      name: "Produto Teste Sem Barcode",
      internalCode: `PILOT-B-${Date.now()}`
    }
  });

  const variantWithoutBarcode = await prisma.productVariant.create({
    data: {
      companyId: company.id,
      productId: prodB.id,
      name: "Único",
      sku: `SKU-PILOT-B-${Date.now()}`,
      barcode: null,
      costPrice: 15,
      salePrice: 35,
      currentStock: 10,
      availableStock: 10
    }
  });

  console.log("\n[STEP 1 & 2] Products with and without barcode created successfully.");

  // 3. Perform sale
  console.log("\n[STEP 3] Finalizing sale in PDV containing both variants...");
  const saleData = {
    companyId: company.id,
    sellerId: seller.id,
    cashRegisterId: cashRegister.id,
    subtotal: 60, // 25 + 35
    discountAmount: 0,
    totalAmount: 60,
    items: [
      {
        variantId: variantWithBarcode.id,
        quantity: 1,
        unitPrice: 25,
        totalPrice: 25,
        productNameSnapshot: prodA.name,
        variantNameSnapshot: variantWithBarcode.name,
        skuSnapshot: variantWithBarcode.sku,
        barcodeSnapshot: variantWithBarcode.barcode, // Should be "7891234567890"
        costPriceAtSale: 10,
        salePriceAtSale: 25,
        marginAtSale: 60
      },
      {
        variantId: variantWithoutBarcode.id,
        quantity: 1,
        unitPrice: 35,
        totalPrice: 35,
        productNameSnapshot: prodB.name,
        variantNameSnapshot: variantWithoutBarcode.name,
        skuSnapshot: variantWithoutBarcode.sku,
        barcodeSnapshot: variantWithoutBarcode.barcode, // Should be null
        costPriceAtSale: 15,
        salePriceAtSale: 35,
        marginAtSale: 57.14
      }
    ],
    payments: [
      {
        paymentMethodId: pmPix.id,
        amount: 60,
        installments: 1
      }
    ]
  };

  const result = await salesService.createSale(saleData, activeUser.id);
  if ('requireAuthorization' in result) {
    throw new Error("Sale unexpectedly required authorization.");
  }
  const saleId = result.id;
  console.log(`  Sale created successfully with ID: ${saleId}`);

  // Verification 3a: sale_items.barcodeSnapshot
  const saleItems = await prisma.saleItem.findMany({
    where: { saleId }
  });

  const itemWithBarcode = saleItems.find(i => i.variantId === variantWithBarcode.id);
  const itemWithoutBarcode = saleItems.find(i => i.variantId === variantWithoutBarcode.id);

  if (itemWithBarcode?.barcodeSnapshot !== "7891234567890") {
    console.error(`  [FAIL] Expected barcodeSnapshot to be '7891234567890', got: ${itemWithBarcode?.barcodeSnapshot}`);
    process.exit(1);
  } else {
    console.log("  [PASS] sale_items.barcodeSnapshot for variant A is correctly '7891234567890'.");
  }

  if (itemWithoutBarcode?.barcodeSnapshot !== null) {
    console.error(`  [FAIL] Expected barcodeSnapshot to be null, got: ${itemWithoutBarcode?.barcodeSnapshot}`);
    process.exit(1);
  } else {
    console.log("  [PASS] sale_items.barcodeSnapshot for variant B is correctly null.");
  }

  // Verification 3b: stock
  const vAStock = await prisma.productVariant.findUnique({ where: { id: variantWithBarcode.id } });
  const vBStock = await prisma.productVariant.findUnique({ where: { id: variantWithoutBarcode.id } });

  if (vAStock?.availableStock.toNumber() !== 9 || vBStock?.availableStock.toNumber() !== 9) {
    console.error(`  [FAIL] Stock not decremented correctly. A: ${vAStock?.availableStock}, B: ${vBStock?.availableStock}`);
    process.exit(1);
  } else {
    console.log("  [PASS] Stock correctly decremented from 10 to 9 for both variants.");
  }

  // Verification 3c: contas a receber
  const receivable = await prisma.accountsReceivable.findFirst({
    where: { companyId: company.id, financialTransaction: { referenceId: saleId } }
  });
  if (!receivable || receivable.status !== "PAID" || receivable.originalAmount.toNumber() !== 60) {
    console.error(`  [FAIL] Receivable validation failed: ${JSON.stringify(receivable)}`);
    process.exit(1);
  } else {
    console.log(`  [PASS] Receivable created and marked as PAID for R$ ${receivable.originalAmount.toNumber()}.`);
  }

  // Verification 3d: comissão
  const commission = await prisma.sellerCommission.findFirst({
    where: { saleId }
  });
  if (!commission || commission.status !== "PENDING") {
    console.error(`  [FAIL] Seller commission validation failed.`);
    process.exit(1);
  } else {
    console.log(`  [PASS] Seller commission created as PENDING for R$ ${commission.amount.toNumber()}.`);
  }

  // Verification 3e: caixa
  const cashRegisterAfter = await prisma.cashRegister.findUnique({ where: { id: cashRegister.id } });
  console.log(`  [INFO] Expected balance in cash register: R$ ${cashRegisterAfter?.expectedBalance?.toNumber()}`);

  // 4. Cancel the sale and verify revert
  console.log("\n[STEP 4] Cancelling the sale and verifying reverse operations...");
  const cancelResult = await salesService.cancelSale({
    saleId,
    cancelReason: "Cancelamento de teste go-live piloto",
    cancelledByUserId: activeUser.id
  });

  if ('requireAuthorization' in cancelResult) {
    console.error(`  [FAIL] Cancellation unexpectedly blocked by authorization.`);
    process.exit(1);
  }

  // Re-verify stocks
  const vAStockAfterCancel = await prisma.productVariant.findUnique({ where: { id: variantWithBarcode.id } });
  const vBStockAfterCancel = await prisma.productVariant.findUnique({ where: { id: variantWithoutBarcode.id } });

  if (vAStockAfterCancel?.availableStock.toNumber() !== 10 || vBStockAfterCancel?.availableStock.toNumber() !== 10) {
    console.error(`  [FAIL] Stock not restored correctly. A: ${vAStockAfterCancel?.availableStock}, B: ${vBStockAfterCancel?.availableStock}`);
    process.exit(1);
  } else {
    console.log("  [PASS] Stock successfully restored back to 10 for both variants.");
  }

  // Re-verify receivables
  const receivableAfterCancel = await prisma.accountsReceivable.findFirst({
    where: { companyId: company.id, financialTransaction: { referenceId: saleId } }
  });
  if (receivableAfterCancel && receivableAfterCancel.status !== "CANCELLED") {
    console.error(`  [FAIL] Expected receivable status to be CANCELLED, got: ${receivableAfterCancel.status}`);
    process.exit(1);
  } else {
    console.log("  [PASS] Accounts receivable successfully marked as CANCELLED.");
  }

  // Re-verify commission
  const commissionAfterCancel = await prisma.sellerCommission.findFirst({
    where: { saleId }
  });
  if (commissionAfterCancel && commissionAfterCancel.status !== "CANCELLED") {
    console.error(`  [FAIL] Expected commission status to be CANCELLED, got: ${commissionAfterCancel.status}`);
    process.exit(1);
  } else {
    console.log("  [PASS] Seller commission successfully marked as CANCELLED.");
  }

  // Cleanup testing entries in correct foreign key order
  console.log("\nCleaning up test sale, transactions and movements...");
  
  // 1. Delete seller commissions
  await prisma.sellerCommission.deleteMany({ where: { saleId } });

  // 2. Delete accounts receivable
  const finTxs = await prisma.financialTransaction.findMany({ where: { referenceType: "SALE", referenceId: saleId } });
  const finTxIds = finTxs.map(f => f.id);
  await prisma.accountsReceivable.deleteMany({ where: { financialTransactionId: { in: finTxIds } } });

  // 3. Delete financial transactions (including fee transactions)
  await prisma.financialTransaction.deleteMany({ where: { referenceType: "SALE_FEE", referenceId: { in: finTxIds } } });
  await prisma.financialTransaction.deleteMany({ where: { id: { in: finTxIds } } });

  // 4. Delete cash movements
  await prisma.cashMovement.deleteMany({ where: { cashRegisterId: cashRegister.id, description: { contains: saleId } } });

  // 5. Delete inventory movements
  await prisma.inventoryMovement.deleteMany({ where: { variantId: { in: [variantWithBarcode.id, variantWithoutBarcode.id] } } });

  // 6. Delete sale items
  await prisma.saleItem.deleteMany({ where: { saleId } });

  // 7. Delete sale payments
  await prisma.salePayment.deleteMany({ where: { saleId } });

  // 8. Delete sale
  await prisma.sale.delete({ where: { id: saleId } });

  // 9. Delete variants & products
  console.log("Cleaning up test products and variants...");
  await prisma.productVariant.deleteMany({
    where: { id: { in: [variantWithBarcode.id, variantWithoutBarcode.id] } }
  });
  await prisma.product.deleteMany({
    where: { id: { in: [prodA.id, prodB.id] } }
  });

  console.log("\n==================================================");
  console.log("🟢 PILOT VALIDATION TESTS COMPLETED SUCCESSFULLY!");
  console.log("==================================================");
}

runPilotValidationTest()
  .catch(err => {
    console.error("Critical error in runPilotValidationTest:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
