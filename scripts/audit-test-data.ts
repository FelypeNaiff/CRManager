import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";
import { resolveTestIds } from "./resolve-test-ids";

const prisma = new PrismaClient();
const REPORTS_DIR = path.join(__dirname, "../reports");

async function runAudit() {
  console.log("==================================================");
  console.log("NEEX TEST DATA AUDIT SERVICE");
  console.log("==================================================");

  // 1. Ensure reports directory exists
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  // Determine output suffix (default is 'before')
  const suffix = process.env.AUDIT_SUFFIX || "before";
  console.log(`Audit Suffix Mode : ${suffix}`);
  console.log("Resolving target test IDs...");
  
  const ids = await resolveTestIds(prisma);

  // 2. Fetch Detailed Data for Report
  console.log("Fetching details for audit report...");

  // Products
  const products = await prisma.product.findMany({
    where: { id: { in: ids.products } },
    include: { category: true }
  });
  const productsSheetData = products.map(p => ({
    ID: p.id,
    Name: p.name,
    InternalCode: p.internalCode,
    Category: p.category?.name || "N/A",
    IsActive: p.isActive ? "Yes" : "No",
    CreatedAt: p.createdAt.toISOString()
  }));

  // Customers
  const customers = await prisma.customer.findMany({
    where: { id: { in: ids.customers } }
  });
  const customersSheetData = customers.map(c => ({
    ID: c.id,
    Name: c.name,
    Phone: c.phone,
    Email: c.email || "N/A",
    Status: c.status,
    CreatedAt: c.createdAt.toISOString()
  }));

  // Sellers
  const sellers = await prisma.seller.findMany({
    where: { id: { in: ids.sellers } }
  });
  const sellersSheetData = sellers.map(s => ({
    ID: s.id,
    Name: s.name,
    Nickname: s.nickname || "N/A",
    CommissionRate: s.commissionRate.toNumber(),
    Goal: s.goal ? s.goal.toNumber() : 0,
    Status: s.status
  }));

  // Sales
  const sales = await prisma.sale.findMany({
    where: { id: { in: ids.sales } },
    include: { customer: true, seller: true }
  });
  const salesSheetData = sales.map(s => ({
    ID: s.id,
    Seller: s.seller?.name || "N/A",
    Customer: s.customer?.name || s.customerNameSnapshot || "N/A",
    Subtotal: s.subtotal.toNumber(),
    Discount: s.discountAmount.toNumber(),
    Total: s.totalAmount.toNumber(),
    Status: s.status,
    Date: s.createdAt.toISOString()
  }));

  // Receivables
  const receivables = await prisma.accountsReceivable.findMany({
    where: { id: { in: ids.accountsReceivable } },
    include: { customer: true }
  });
  const receivablesSheetData = receivables.map(r => ({
    ID: r.id,
    Customer: r.customer?.name || "N/A",
    OriginalAmount: r.originalAmount.toNumber(),
    PaidAmount: r.paidAmount.toNumber(),
    RemainingAmount: r.remainingAmount.toNumber(),
    DueDate: r.dueDate.toISOString(),
    Status: r.status
  }));

  // Inventory Movements
  const movements = await prisma.inventoryMovement.findMany({
    where: { id: { in: ids.inventoryMovements } },
    include: { variant: { include: { product: true } } }
  });
  const movementsSheetData = movements.map(m => ({
    ID: m.id,
    Product: m.variant?.product?.name || "N/A",
    Variant: m.variant?.name || "N/A",
    SKU: m.variant?.sku || "N/A",
    Quantity: m.quantity.toNumber(),
    Type: m.type,
    Reason: m.reason || "N/A",
    Date: m.createdAt.toISOString()
  }));

  // Wallets
  const wallets = await prisma.customerWallet.findMany({
    where: { id: { in: ids.customerWallets } },
    include: { customer: true }
  });
  const walletsSheetData = wallets.map(w => ({
    ID: w.id,
    CustomerName: w.customer?.name || "N/A",
    Balance: w.balance.toNumber(),
    CreatedAt: w.createdAt.toISOString()
  }));

  // Banks & Payment Methods
  const banks = await prisma.bankAccount.findMany({
    where: { id: { in: ids.bankAccounts } }
  });
  const banksSheetData = banks.map(b => ({
    ID: b.id,
    Name: b.name,
    BankName: b.bankName || "N/A",
    AccountNumber: b.accountNumber || "N/A",
    CurrentBalance: b.currentBalance.toNumber(),
    IsActive: b.isActive ? "Yes" : "No"
  }));

  const pms = await prisma.paymentMethod.findMany({
    where: { id: { in: ids.paymentMethods } }
  });
  const pmsSheetData = pms.map(pm => ({
    ID: pm.id,
    Name: pm.name,
    Type: pm.type,
    IsActive: pm.isActive ? "Yes" : "No"
  }));

  // Detailed IDs
  const allTableNames = Object.keys(ids) as Array<keyof typeof ids>;
  const detailedIdsSheetData: Array<{ Table: string; ID: string }> = [];
  allTableNames.forEach(tableName => {
    const list = ids[tableName];
    list.forEach(id => {
      detailedIdsSheetData.push({ Table: tableName, ID: id });
    });
  });

  // Summary statistics
  const summarySheetData = [
    { Entidade: "Produtos", Encontrados: ids.products.length },
    { Entidade: "Variantes", Encontrados: ids.productVariants.length },
    { Entidade: "Clientes", Encontrados: ids.customers.length },
    { Entidade: "Filhos CRM", Encontrados: ids.customerChildren.length },
    { Entidade: "Vendedores", Encontrados: ids.sellers.length },
    { Entidade: "Metas Vendedores", Encontrados: ids.sellerGoals.length },
    { Entidade: "Comissões", Encontrados: ids.sellerCommissions.length },
    { Entidade: "Vendas", Encontrados: ids.sales.length },
    { Entidade: "Itens de Venda", Encontrados: ids.saleItems.length },
    { Entidade: "Pagamentos de Venda", Encontrados: ids.salePayments.length },
    { Entidade: "Autorizações de Venda", Encontrados: ids.saleAuthorizations.length },
    { Entidade: "Trocas de Venda", Encontrados: ids.saleExchanges.length },
    { Entidade: "Devoluções de Venda", Encontrados: ids.saleReturns.length },
    { Entidade: "Contas a Receber (Recebíveis)", Encontrados: ids.accountsReceivable.length },
    { Entidade: "Transações Financeiras", Encontrados: ids.financialTransactions.length },
    { Entidade: "Movimentações de Estoque", Encontrados: ids.inventoryMovements.length },
    { Entidade: "Carteiras de Clientes", Encontrados: ids.customerWallets.length },
    { Entidade: "Movimentações de Carteira", Encontrados: ids.customerWalletMovements.length },
    { Entidade: "Transações de Carteira", Encontrados: ids.walletTransactions.length },
    { Entidade: "Contas Bancárias", Encontrados: ids.bankAccounts.length },
    { Entidade: "Formas de Pagamento", Encontrados: ids.paymentMethods.length },
    { Entidade: "Caixas Registradoras", Encontrados: ids.cashRegisters.length },
    { Entidade: "Movimentações de Caixa", Encontrados: ids.cashMovements.length },
    { Entidade: "Trocas/Devoluções Específicas", Encontrados: ids.exchangeReturns.length },
    { Entidade: "Itens de Troca/Devolução", Encontrados: ids.exchangeReturnItems.length },
    { Entidade: "Histórico de Preços", Encontrados: ids.productPriceHistories.length },
    { Entidade: "Logs de Atividades", Encontrados: ids.activityLogs.length },
    { Entidade: "Usuários", Encontrados: ids.users.length }
  ];

  console.log("\nSummary of found test records:");
  summarySheetData.forEach(item => {
    if (item.Encontrados > 0) {
      console.log(`  - ${item.Entidade}: ${item.Encontrados}`);
    }
  });

  // 3. Write Excel Spreadsheet
  console.log("\nWriting Excel reports...");
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summarySheetData), "Resumo");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productsSheetData), "Produtos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customersSheetData), "Clientes");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sellersSheetData), "Vendedores");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesSheetData), "Vendas");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(receivablesSheetData), "Recebíveis");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movementsSheetData), "Movimentações");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(walletsSheetData), "Carteiras");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(banksSheetData), "Bancos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pmsSheetData), "Formas de Pagamento");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailedIdsSheetData), "Todos IDs");

  // Output paths
  const filePrefix = `test-data-audit-${suffix}`;
  const excelPath = path.join(REPORTS_DIR, `${filePrefix}.xlsx`);
  const jsonPath = path.join(REPORTS_DIR, `${filePrefix}.json`);

  XLSX.writeFile(wb, excelPath);
  fs.writeFileSync(jsonPath, JSON.stringify({ summary: summarySheetData, details: ids }, null, 2));

  console.log(`Saved audit report to:`);
  console.log(`  Excel: ${excelPath}`);
  console.log(`  JSON : ${jsonPath}`);

  // If before/default, also save as reports/test-data-audit.json and .xlsx
  if (suffix !== "after") {
    const defaultExcelPath = path.join(REPORTS_DIR, "test-data-audit.xlsx");
    const defaultJsonPath = path.join(REPORTS_DIR, "test-data-audit.json");
    XLSX.writeFile(wb, defaultExcelPath);
    fs.writeFileSync(defaultJsonPath, JSON.stringify({ summary: summarySheetData, details: ids }, null, 2));
    console.log(`Saved default audit report to:`);
    console.log(`  Excel: ${defaultExcelPath}`);
    console.log(`  JSON : ${defaultJsonPath}`);
  }

  console.log("==================================================");
  console.log("AUDIT PROCESS COMPLETED SUCCESSFULLY");
  console.log("==================================================");
}

runAudit()
  .catch(err => {
    console.error("Critical error in runAudit:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
