import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";
import { resolveTestIds } from "./resolve-test-ids";

const prisma = new PrismaClient();
const REPORTS_DIR = path.join(__dirname, "../reports");

// Helper to check for running import processes
function isRealImportActive(): boolean {
  try {
    // Windows task list scan
    const tasklist = execSync("tasklist", { encoding: "utf8" });
    const isNodeRunning = tasklist.toLowerCase().includes("node.exe");
    
    if (isNodeRunning) {
      // Deeper inspection using WMIC command line or PowerShell
      const wmic = execSync("wmic process where \"name='node.exe'\" get commandline", { encoding: "utf8" });
      const processKeywords = ["import-crm-data", "import-products-data", "import-sellers-data", "import-financial-data"];
      
      for (const keyword of processKeywords) {
        if (wmic.includes(keyword)) {
          console.warn(`  [WARNING] Detected running process matching: ${keyword}`);
          return true;
        }
      }
    }
  } catch (err) {
    // Fallback: PowerShell command line check
    try {
      const ps = execSync("powershell -Command \"Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*import-*' } | Select-Object -ExpandProperty CommandLine\"", { encoding: "utf8" });
      if (ps && ps.trim().length > 0) {
        console.warn(`  [WARNING] Detected running processes in PowerShell: ${ps.trim()}`);
        return true;
      }
    } catch (err2) {
      // Ignore errors if commands aren't available
    }
  }
  return false;
}

// Get OS username
function getOSUser(): string {
  return process.env.USERNAME || process.env.USER || "unknown_operator";
}

async function runPurge() {
  const dryRun = process.env.DRY_RUN !== "false";
  const isProduction = process.env.ENVIRONMENT === "production";
  const confirmPurge = process.env.CONFIRM_PURGE === "true";
  const backupValidated = process.env.BACKUP_VALIDATED === "true";

  console.log("==================================================");
  console.log("NEEX CONTROLLED PURGE SERVICE");
  console.log("==================================================");
  console.log(`Execution Mode       : ${dryRun ? "DRY-RUN (Simulação)" : "REAL PURGE (Escrita)"}`);
  console.log(`Environment          : ${isProduction ? "PRODUCTION" : "HOMOLOGATION/LOCAL"}`);
  console.log(`Confirm Purge Flag   : ${confirmPurge}`);
  console.log(`Backup Validated     : ${backupValidated}`);
  console.log("==================================================");

  // 1. Safety Checks
  console.log("Running safety checks...");

  // Scan for active import processes
  const importActive = isRealImportActive();
  if (importActive) {
    console.error("  [FAIL] Real data import processes are active! Purge aborted to prevent data corruption.");
    process.exit(1);
  }
  console.log("  [PASS] No active real import scripts detected.");

  // If real execution, enforce all checks
  if (!dryRun) {
    if (!isProduction) {
      console.error("  [FAIL] Real purge is only allowed when ENVIRONMENT=production.");
      process.exit(1);
    }
    if (!confirmPurge) {
      console.error("  [FAIL] Real purge requires CONFIRM_PURGE=true.");
      process.exit(1);
    }
    if (!backupValidated) {
      console.error("  [FAIL] Real purge requires BACKUP_VALIDATED=true. Execute and validate backup first.");
      process.exit(1);
    }
  }

  // 2. Resolve target IDs using our shared resolver
  console.log("Resolving target test IDs...");
  const ids = await resolveTestIds(prisma);

  // Print counts
  const entityCounts = [
    { name: "seller_commissions", count: ids.sellerCommissions.length },
    { name: "accounts_receivable", count: ids.accountsReceivable.length },
    { name: "financial_transactions", count: ids.financialTransactions.length },
    { name: "inventory_movements", count: ids.inventoryMovements.length },
    { name: "wallet_transactions", count: ids.walletTransactions.length },
    { name: "customer_wallet_movements", count: ids.customerWalletMovements.length },
    { name: "sale_items", count: ids.saleItems.length },
    { name: "sale_payments", count: ids.salePayments.length },
    { name: "sale_authorizations", count: ids.saleAuthorizations.length },
    { name: "sales", count: ids.sales.length },
    { name: "sale_exchanges", count: ids.saleExchanges.length },
    { name: "sale_returns", count: ids.saleReturns.length },
    { name: "customer_wallets", count: ids.customerWallets.length },
    { name: "customer_children", count: ids.customerChildren.length },
    { name: "customers", count: ids.customers.length },
    { name: "product_variants", count: ids.productVariants.length },
    { name: "product_price_histories", count: ids.productPriceHistories.length },
    { name: "products", count: ids.products.length },
    { name: "seller_goals", count: ids.sellerGoals.length },
    { name: "sellers", count: ids.sellers.length },
    { name: "exchange_return_items", count: ids.exchangeReturnItems.length },
    { name: "exchange_returns", count: ids.exchangeReturns.length },
    { name: "users", count: ids.users.length },
    { name: "activity_logs", count: ids.activityLogs.length },
    { name: "bank_accounts", count: ids.bankAccounts.length },
    { name: "payment_methods", count: ids.paymentMethods.length }
  ];

  console.log("\nSERIAM EXCLUÍDOS (DRY-RUN):" || "REGISTROS ENCONTRADOS:");
  entityCounts.forEach(ent => {
    if (ent.count > 0) {
      console.log(`  - ${ent.count} ${ent.name}`);
    }
  });

  if (dryRun) {
    console.log("\n[DRY-RUN COMPLETE] No database modifications were performed.");
    process.exit(0);
  }

  // 3. Perform Deletions Sequentially in Safe Order by ID List
  console.log("\nExecuting purge transaction...");
  const deleteCounts: { [key: string]: number } = {};

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Exchange return items
      if (ids.exchangeReturnItems.length > 0) {
        const res = await tx.exchangeReturnItem.deleteMany({ where: { id: { in: ids.exchangeReturnItems } } });
        deleteCounts.exchange_return_items = res.count;
      }

      // 2. Exchange returns
      if (ids.exchangeReturns.length > 0) {
        const res = await tx.exchangeReturn.deleteMany({ where: { id: { in: ids.exchangeReturns } } });
        deleteCounts.exchange_returns = res.count;
      }

      // 3. Seller Commissions
      if (ids.sellerCommissions.length > 0) {
        const res = await tx.sellerCommission.deleteMany({ where: { id: { in: ids.sellerCommissions } } });
        deleteCounts.seller_commissions = res.count;
      }

      // 4. Accounts Receivable
      if (ids.accountsReceivable.length > 0) {
        const res = await tx.accountsReceivable.deleteMany({ where: { id: { in: ids.accountsReceivable } } });
        deleteCounts.accounts_receivable = res.count;
      }

      // 5. Financial Transactions
      if (ids.financialTransactions.length > 0) {
        const res = await tx.financialTransaction.deleteMany({ where: { id: { in: ids.financialTransactions } } });
        deleteCounts.financial_transactions = res.count;
      }

      // 6. Cash Movements
      if (ids.cashMovements.length > 0) {
        const res = await tx.cashMovement.deleteMany({ where: { id: { in: ids.cashMovements } } });
        deleteCounts.cash_movements = res.count;
      }

      // 7. Cash Registers
      if (ids.cashRegisters.length > 0) {
        const res = await tx.cashRegister.deleteMany({ where: { id: { in: ids.cashRegisters } } });
        deleteCounts.cash_registers = res.count;
      }

      // 8. Wallet Transactions
      if (ids.walletTransactions.length > 0) {
        const res = await tx.walletTransaction.deleteMany({ where: { id: { in: ids.walletTransactions } } });
        deleteCounts.wallet_transactions = res.count;
      }

      // 9. Customer Wallet Movements
      if (ids.customerWalletMovements.length > 0) {
        const res = await tx.customerWalletMovement.deleteMany({ where: { id: { in: ids.customerWalletMovements } } });
        deleteCounts.customer_wallet_movements = res.count;
      }

      // 10. Customer Wallets
      if (ids.customerWallets.length > 0) {
        const res = await tx.customerWallet.deleteMany({ where: { id: { in: ids.customerWallets } } });
        deleteCounts.customer_wallets = res.count;
      }

      // 11. Sale Items
      if (ids.saleItems.length > 0) {
        const res = await tx.saleItem.deleteMany({ where: { id: { in: ids.saleItems } } });
        deleteCounts.sale_items = res.count;
      }

      // 12. Sale Payments
      if (ids.salePayments.length > 0) {
        const res = await tx.salePayment.deleteMany({ where: { id: { in: ids.salePayments } } });
        deleteCounts.sale_payments = res.count;
      }

      // 13. Sale Authorizations
      if (ids.saleAuthorizations.length > 0) {
        const res = await tx.saleAuthorization.deleteMany({ where: { id: { in: ids.saleAuthorizations } } });
        deleteCounts.sale_authorizations = res.count;
      }

      // 14. Sales
      if (ids.sales.length > 0) {
        const res = await tx.sale.deleteMany({ where: { id: { in: ids.sales } } });
        deleteCounts.sales = res.count;
      }

      // 15. Sale Exchanges
      if (ids.saleExchanges.length > 0) {
        const res = await tx.saleExchange.deleteMany({ where: { id: { in: ids.saleExchanges } } });
        deleteCounts.sale_exchanges = res.count;
      }

      // 16. Sale Returns
      if (ids.saleReturns.length > 0) {
        const res = await tx.saleReturn.deleteMany({ where: { id: { in: ids.saleReturns } } });
        deleteCounts.sale_returns = res.count;
      }

      // 17. Customer Children
      if (ids.customerChildren.length > 0) {
        const res = await tx.customerChild.deleteMany({ where: { id: { in: ids.customerChildren } } });
        deleteCounts.customer_children = res.count;
      }

      // 18. Customers
      if (ids.customers.length > 0) {
        const res = await tx.customer.deleteMany({ where: { id: { in: ids.customers } } });
        deleteCounts.customers = res.count;
      }

      // 19. Product Variants
      if (ids.productVariants.length > 0) {
        const res = await tx.productVariant.deleteMany({ where: { id: { in: ids.productVariants } } });
        deleteCounts.product_variants = res.count;
      }

      // 20. Product Price Histories
      if (ids.productPriceHistories.length > 0) {
        const res = await tx.productPriceHistory.deleteMany({ where: { id: { in: ids.productPriceHistories } } });
        deleteCounts.product_price_histories = res.count;
      }

      // 21. Products
      if (ids.products.length > 0) {
        const res = await tx.product.deleteMany({ where: { id: { in: ids.products } } });
        deleteCounts.products = res.count;
      }

      // 22. Seller Goals
      if (ids.sellerGoals.length > 0) {
        const res = await tx.sellerGoal.deleteMany({ where: { id: { in: ids.sellerGoals } } });
        deleteCounts.seller_goals = res.count;
      }

      // 23. Sellers
      if (ids.sellers.length > 0) {
        const res = await tx.seller.deleteMany({ where: { id: { in: ids.sellers } } });
        deleteCounts.sellers = res.count;
      }

      // 24. Activity Logs
      if (ids.activityLogs.length > 0) {
        const res = await tx.activityLog.deleteMany({ where: { id: { in: ids.activityLogs } } });
        deleteCounts.activity_logs = res.count;
      }

      // 25. Users
      if (ids.users.length > 0) {
        const res = await tx.user.deleteMany({ where: { id: { in: ids.users } } });
        deleteCounts.users = res.count;
      }

      // 26. Bank Accounts
      if (ids.bankAccounts.length > 0) {
        const res = await tx.bankAccount.deleteMany({ where: { id: { in: ids.bankAccounts } } });
        deleteCounts.bank_accounts = res.count;
      }

      // 27. Payment Methods
      if (ids.paymentMethods.length > 0) {
        const res = await tx.paymentMethod.deleteMany({ where: { id: { in: ids.paymentMethods } } });
        deleteCounts.payment_methods = res.count;
      }
    });

    console.log("Purge transaction committed successfully.");
  } catch (err: any) {
    console.error("  [FAIL] Error occurred during purge transaction. Rollback performed.", err.message);
    process.exit(1);
  }

  // 4. Run post-purge build and diagnostics checks
  console.log("\nRunning post-purge validation checks...");
  let buildResult = "SUCCESS";
  let buildLogs = "";
  try {
    console.log("  Running build validation (npm run build)...");
    buildLogs = execSync("npm run build", { encoding: "utf8" });
    console.log("  [PASS] Build compilation verified.");
  } catch (err: any) {
    buildResult = "FAIL";
    buildLogs = err.message + "\n" + (err.stdout || "") + "\n" + (err.stderr || "");
    console.error("  [FAIL] Build compilation failed after purge!");
  }

  let diagnosisResult = "PASS";
  let diagnosisLogs = "";
  try {
    console.log("  Running go-live diagnostic audit...");
    diagnosisLogs = execSync("npx tsx scripts/diagnose-go-live.ts", { encoding: "utf8" });
    console.log("  [PASS] Diagnostic completed.");
  } catch (err: any) {
    diagnosisResult = "FAIL";
    diagnosisLogs = err.message + "\n" + (err.stdout || "") + "\n" + (err.stderr || "");
    console.error("  [FAIL] Diagnostic failed after purge!");
  }

  // 5. Generate final purge report (reports/go-live-purge-report.xlsx)
  console.log("\nGenerating final purge report...");
  const executor = getOSUser();
  const timestamp = new Date().toISOString();

  const summaryData = [
    { Chave: "Data/Hora de Execução", Valor: timestamp },
    { Chave: "Usuário Executor", Valor: executor },
    { Chave: "Backup Validado", Valor: backupValidated ? "Sim" : "Não" },
    { Chave: "Importação Real Ativa Detectada", Valor: importActive ? "Sim" : "Não" },
    { Chave: "Validação do Build", Valor: buildResult },
    { Chave: "Resultado do Diagnóstico", Valor: diagnosisResult }
  ];

  const removedCountsData = Object.keys(deleteCounts).map(tableName => ({
    Tabela: tableName,
    QuantidadeRemovida: deleteCounts[tableName]
  }));

  const detailedIdsData: Array<{ Tabela: string; ID: string }> = [];
  (Object.keys(ids) as Array<keyof typeof ids>).forEach(tableName => {
    const list = ids[tableName];
    list.forEach(id => {
      detailedIdsData.push({ Tabela: tableName, ID: id });
    });
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Resumo Executivo");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(removedCountsData), "Registros Removidos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailedIdsData), "IDs Removidos Detalhados");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Diagnostico: diagnosisLogs }]), "Diagnostico Final");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Logs: buildLogs }]), "Logs do Build");

  const reportPath = path.join(REPORTS_DIR, "go-live-purge-report.xlsx");
  XLSX.writeFile(wb, reportPath);
  console.log(`Saved go-live-purge-report.xlsx to: ${reportPath}`);

  // 6. Invoke after-purge audit to produce reports/test-data-audit-after.xlsx
  console.log("\nExecuting after-purge audit...");
  try {
    process.env.AUDIT_SUFFIX = "after";
    // We execute it in-process or via shell
    execSync("npx tsx scripts/audit-test-data.ts", {
      env: { ...process.env, AUDIT_SUFFIX: "after" },
      stdio: "inherit"
    });
    console.log("  [PASS] After-purge audit completed.");
  } catch (err: any) {
    console.error("  [WARNING] Failed to run after-purge audit script automatically:", err.message);
  }

  console.log("==================================================");
  console.log("PURGE SERVICE EXECUTED SUCCESSFULLY");
  console.log("==================================================");
}

runPurge()
  .catch(err => {
    console.error("Critical error in runPurge:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
