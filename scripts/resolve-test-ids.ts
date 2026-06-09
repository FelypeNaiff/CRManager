import { PrismaClient } from "@prisma/client";

// Strong patterns: if any mapped text field matches these, the record is test/mock.
const STRONG_PATTERNS = ["TEST", "TESTE", "AUDIT", "AUDITORIA", "CONCURRENCY"];

// Weak patterns: only matched if combined with known names, prefixes, or relationships.
const WEAK_PATTERNS = ["PILOT", "CLEAN", "ESPECIAL"];

// Known exact test names
const KNOWN_TEST_PRODUCTS = [
  "Vestido Infantil clean",
  "Conjunto Verão clean",
  "Sapatinho Bebê clean",
  "Produto Teste Com Barcode",
  "Produto Teste Sem Barcode",
  "Test Product 6C",
  "Test Product 6D",
  "Test Product PDV",
  "Product Concurrency Test",
  "Product Audit Test"
];

const KNOWN_TEST_CUSTOMERS = [
  "Joana Silva clean",
  "Carlos Souza clean",
  "Paula Abreu clean",
  "Test PDV Customer",
  "Customer Audit Test",
  "Customer Concurrency Test",
  "Teste Cliente C1",
  "Teste Cliente C2",
  "Test Exchange"
];

const KNOWN_TEST_SELLERS = [
  "Vendedor Especial 1",
  "Vendedor Especial 2",
  "Vendedor Teste Concorrencia",
  "Audit Seller"
];

const KNOWN_TEST_BANKS = [
  "Test Bank Account",
  "Caixa Piloto Teste",
  "Concurrency Test Bank",
  "Audit Test Bank"
];

const KNOWN_TEST_PMS = [
  "Test PM CASH",
  "Test PM PIX",
  "Test PM DEBIT_CARD",
  "Test PM CREDIT_CARD",
  "Test PM STORE_CREDIT",
  "Test PM CUSTOMER_WALLET",
  "Dinheiro Concorrente",
  "Carteira Concorrente",
  "PIX Piloto"
];

// Known prefixes
const KNOWN_PREFIXES = [
  "AUDIT-", "CONC-", "TST-PDV-", "PILOT-A-", "PILOT-B-", "TST-6C-", "TST-6D-",
  "SKU-AUDIT-", "SKU-CONC-", "SKU-PDV-", "SKU-PILOT-"
];

// Helper to check strong match
function hasStrongMatch(text: string | null | undefined): boolean {
  if (!text) return false;
  const upper = text.toUpperCase();
  return STRONG_PATTERNS.some(p => upper.includes(p));
}

// Helper to check prefix match
function hasPrefixMatch(text: string | null | undefined): boolean {
  if (!text) return false;
  const upper = text.toUpperCase();
  return KNOWN_PREFIXES.some(prefix => upper.startsWith(prefix));
}

export interface TargetIds {
  users: string[];
  sellers: string[];
  sellerGoals: string[];
  sellerCommissions: string[];
  products: string[];
  productVariants: string[];
  productPriceHistories: string[];
  customers: string[];
  customerChildren: string[];
  customerWallets: string[];
  customerWalletMovements: string[];
  walletTransactions: string[];
  bankAccounts: string[];
  paymentMethods: string[];
  cashRegisters: string[];
  cashMovements: string[];
  sales: string[];
  saleItems: string[];
  salePayments: string[];
  saleAuthorizations: string[];
  saleExchanges: string[];
  saleReturns: string[];
  exchangeReturns: string[];
  exchangeReturnItems: string[];
  financialTransactions: string[];
  accountsReceivable: string[];
  activityLogs: string[];
  inventoryMovements: string[];
}

export async function resolveTestIds(prisma: PrismaClient): Promise<TargetIds> {
  // --- PASS 1: Resolve primary entities ---

  // 1. Users
  const allUsers = await prisma.user.findMany();
  const testUsers = allUsers.filter(u => {
    return (
      hasStrongMatch(u.name) ||
      hasStrongMatch(u.username) ||
      hasStrongMatch(u.email) ||
      (u.email && (u.email.endsWith("@test.com") || u.email.includes("auth@"))) ||
      ["Admin Auth", "Seller Auth", "Admin Audit Test", "Admin Concurrency Test"].includes(u.name)
    );
  });
  const userIds = testUsers.map(u => u.id);

  // 2. Sellers
  const allSellers = await prisma.seller.findMany();
  const testSellers = allSellers.filter(s => {
    return (
      hasStrongMatch(s.name) ||
      hasStrongMatch(s.nickname) ||
      hasStrongMatch(s.email) ||
      KNOWN_TEST_SELLERS.includes(s.name)
    );
  });
  const sellerIds = testSellers.map(s => s.id);

  // 3. Products
  const allProducts = await prisma.product.findMany();
  const testProducts = allProducts.filter(p => {
    return (
      hasStrongMatch(p.name) ||
      hasStrongMatch(p.internalCode) ||
      hasStrongMatch(p.description) ||
      hasPrefixMatch(p.internalCode) ||
      KNOWN_TEST_PRODUCTS.includes(p.name)
    );
  });
  const productIds = testProducts.map(p => p.id);

  // 4. Product Variants
  const allVariants = await prisma.productVariant.findMany();
  const testVariants = allVariants.filter(v => {
    return (
      productIds.includes(v.productId) ||
      hasStrongMatch(v.name) ||
      hasStrongMatch(v.sku) ||
      hasStrongMatch(v.barcode) ||
      hasPrefixMatch(v.sku)
    );
  });
  const variantIds = testVariants.map(v => v.id);

  // 5. Customers
  const allCustomers = await prisma.customer.findMany();
  const testCustomers = allCustomers.filter(c => {
    return (
      hasStrongMatch(c.name) ||
      hasStrongMatch(c.email) ||
      hasStrongMatch(c.phone) ||
      KNOWN_TEST_CUSTOMERS.includes(c.name)
    );
  });
  const customerIds = testCustomers.map(c => c.id);

  // 6. Bank Accounts
  const allBankAccounts = await prisma.bankAccount.findMany();
  const testBankAccounts = allBankAccounts.filter(b => {
    return (
      hasStrongMatch(b.name) ||
      hasStrongMatch(b.bankName) ||
      KNOWN_TEST_BANKS.includes(b.name)
    );
  });
  const bankAccountIds = testBankAccounts.map(b => b.id);

  // 7. Payment Methods
  const allPaymentMethods = await prisma.paymentMethod.findMany();
  const testPaymentMethods = allPaymentMethods.filter(pm => {
    return (
      hasStrongMatch(pm.name) ||
      KNOWN_TEST_PMS.includes(pm.name)
    );
  });
  const paymentMethodIds = testPaymentMethods.map(pm => pm.id);

  // --- PASS 2: Resolve secondary/linked entities ---

  // 8. Cash Registers
  const allCashRegisters = await prisma.cashRegister.findMany();
  const testCashRegisters = allCashRegisters.filter(cr => {
    return (
      hasStrongMatch(cr.notes) ||
      userIds.includes(cr.openedByUserId) ||
      (cr.closedByUserId && userIds.includes(cr.closedByUserId)) ||
      bankAccountIds.includes(cr.bankAccountId)
    );
  });
  const cashRegisterIds = testCashRegisters.map(cr => cr.id);

  // 9. Sales
  const allSales = await prisma.sale.findMany({
    include: { items: true }
  });
  const testSales = allSales.filter(s => {
    return (
      hasStrongMatch(s.notes) ||
      hasStrongMatch(s.cancelReason) ||
      hasStrongMatch(s.customerNameSnapshot) ||
      hasStrongMatch(s.customerPhoneSnapshot) ||
      (s.customerId && customerIds.includes(s.customerId)) ||
      sellerIds.includes(s.sellerId) ||
      (s.cashRegisterId && cashRegisterIds.includes(s.cashRegisterId)) ||
      s.items.some(item => variantIds.includes(item.variantId))
    );
  });
  const saleIds = testSales.map(s => s.id);

  // 10. Sale items, payments, authorizations, commissions, goals
  const saleItemIds = (await prisma.saleItem.findMany({
    where: { OR: [{ saleId: { in: saleIds } }, { variantId: { in: variantIds } }] }
  })).map(i => i.id);

  const salePaymentIds = (await prisma.salePayment.findMany({
    where: { saleId: { in: saleIds } }
  })).map(p => p.id);

  const saleAuthIds = (await prisma.saleAuthorization.findMany({
    where: {
      OR: [
        { saleId: { in: saleIds } },
        { requestedByUserId: { in: userIds } },
        { authorizedByUserId: { in: userIds } }
      ]
    }
  })).map(a => a.id);

  const commissionIds = (await prisma.sellerCommission.findMany({
    where: { OR: [{ saleId: { in: saleIds } }, { sellerId: { in: sellerIds } }] }
  })).map(c => c.id);

  const sellerGoalIds = (await prisma.sellerGoal.findMany({
    where: { sellerId: { in: sellerIds } }
  })).map(g => g.id);

  // 11. Customer children, wallets, wallet transactions, wallet movements
  const customerChildIds = (await prisma.customerChild.findMany({
    where: { customerId: { in: customerIds } }
  })).map(cc => cc.id);

  const wallets = await prisma.customerWallet.findMany({
    where: { customerId: { in: customerIds } }
  });
  const walletIds = wallets.map(w => w.id);

  const walletMovementIds = (await prisma.customerWalletMovement.findMany({
    where: { walletId: { in: walletIds } }
  })).map(m => m.id);

  const walletTxIds = (await prisma.walletTransaction.findMany({
    where: {
      OR: [
        { walletId: { in: walletIds } },
        { customerId: { in: customerIds } },
        { saleId: { in: saleIds } }
      ]
    }
  })).map(wt => wt.id);

  // 12. Exchange returns, exchange return items
  const exchangeReturns = await prisma.exchangeReturn.findMany({
    where: {
      OR: [
        { originalSaleId: { in: saleIds } },
        { customerId: { in: customerIds } }
      ]
    }
  });
  const exchangeReturnIds = exchangeReturns.map(er => er.id);

  const exchangeReturnItemIds = (await prisma.exchangeReturnItem.findMany({
    where: {
      OR: [
        { exchangeReturnId: { in: exchangeReturnIds } },
        { variantId: { in: variantIds } }
      ]
    }
  })).map(eri => eri.id);

  // Sale exchanges and sale returns (no FKs but referenced by ID)
  const saleExchangeIds = (await prisma.saleExchange.findMany({
    where: {
      OR: [
        { originalSaleId: { in: saleIds } },
        { customerId: { in: customerIds } }
      ]
    }
  })).map(se => se.id);

  const saleReturnIds = (await prisma.saleReturn.findMany({
    where: {
      OR: [
        { originalSaleId: { in: saleIds } },
        { customerId: { in: customerIds } }
      ]
    }
  })).map(sr => sr.id);

  // 13. Product Price Histories
  const priceHistoryIds = (await prisma.productPriceHistory.findMany({
    where: { productId: { in: productIds } }
  })).map(ph => ph.id);

  // 14. Financial Transactions
  const testFinancialTxs = await prisma.financialTransaction.findMany();
  const matchedFinancialTxs = testFinancialTxs.filter(tx => {
    return (
      hasStrongMatch(tx.description) ||
      hasStrongMatch(tx.externalReference) ||
      (tx.referenceType === "SALE" && tx.referenceId && saleIds.includes(tx.referenceId)) ||
      (tx.bankAccountId && bankAccountIds.includes(tx.bankAccountId)) ||
      (tx.cashRegisterId && cashRegisterIds.includes(tx.cashRegisterId)) ||
      (tx.paymentMethodId && paymentMethodIds.includes(tx.paymentMethodId)) ||
      (tx.customerId && customerIds.includes(tx.customerId)) ||
      userIds.includes(tx.createdByUserId)
    );
  });
  const financialTxIds = matchedFinancialTxs.map(tx => tx.id);

  // 15. Accounts Receivable
  const testReceivables = await prisma.accountsReceivable.findMany();
  const matchedReceivables = testReceivables.filter(ar => {
    return (
      hasStrongMatch(ar.notes) ||
      (ar.customerId && customerIds.includes(ar.customerId)) ||
      (ar.financialTransactionId && financialTxIds.includes(ar.financialTransactionId))
    );
  });
  const accountsReceivableIds = matchedReceivables.map(ar => ar.id);

  // 16. Cash Movements
  const testCashMovements = await prisma.cashMovement.findMany();
  const matchedCashMovements = testCashMovements.filter(cm => {
    return (
      hasStrongMatch(cm.description) ||
      cashRegisterIds.includes(cm.cashRegisterId) ||
      userIds.includes(cm.createdByUserId)
    );
  });
  const cashMovementIds = matchedCashMovements.map(cm => cm.id);

  // 17. Inventory Movements
  const testInventoryMovements = await prisma.inventoryMovement.findMany();
  const matchedInventoryMovements = testInventoryMovements.filter(im => {
    return (
      variantIds.includes(im.variantId) ||
      (im.userId && userIds.includes(im.userId)) ||
      hasStrongMatch(im.reason)
    );
  });
  const inventoryMovementIds = matchedInventoryMovements.map(im => im.id);

  // 18. Activity Logs
  const testLogs = await prisma.activityLog.findMany();
  const matchedLogs = testLogs.filter(log => {
    return (
      userIds.includes(log.userId) ||
      hasStrongMatch(log.details) ||
      hasStrongMatch(log.action) ||
      hasStrongMatch(log.module)
    );
  });
  const activityLogIds = matchedLogs.map(log => log.id);

  return {
    users: userIds,
    sellers: sellerIds,
    sellerGoals: sellerGoalIds,
    sellerCommissions: commissionIds,
    products: productIds,
    productVariants: variantIds,
    productPriceHistories: priceHistoryIds,
    customers: customerIds,
    customerChildren: customerChildIds,
    customerWallets: walletIds,
    customerWalletMovements: walletMovementIds,
    walletTransactions: walletTxIds,
    bankAccounts: bankAccountIds,
    paymentMethods: paymentMethodIds,
    cashRegisters: cashRegisterIds,
    cashMovements: cashMovementIds,
    sales: saleIds,
    saleItems: saleItemIds,
    salePayments: salePaymentIds,
    saleAuthorizations: saleAuthIds,
    saleExchanges: saleExchangeIds,
    saleReturns: saleReturnIds,
    exchangeReturns: exchangeReturnIds,
    exchangeReturnItems: exchangeReturnItemIds,
    financialTransactions: financialTxIds,
    accountsReceivable: accountsReceivableIds,
    activityLogs: activityLogIds,
    inventoryMovements: inventoryMovementIds
  };
}
