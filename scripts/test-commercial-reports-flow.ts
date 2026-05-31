import { PrismaClient } from "@prisma/client";
import { CommercialReportService } from "../src/lib/reports/commercial-report-service";

const prisma = new PrismaClient();
const reportService = new CommercialReportService();

async function runTests() {
  console.log("Starting Phase 6H Commercial Reports Tests...");

  const company = await prisma.company.findFirst();
  if (!company) throw new Error("No company found. Ensure seed data exists.");

  const filters = { companyId: company.id };

  // 1. Dashboard
  console.log("Testing getDashboardMetrics...");
  const dash = await reportService.getDashboardMetrics(filters);
  if (typeof dash.grossRevenue !== "number") throw new Error("Dashboard metrics failed");
  console.log("[PASS] Dashboard metrics.");

  // 2. Sales Report
  console.log("Testing getSalesReport...");
  const sales = await reportService.getSalesReport(filters);
  if (!Array.isArray(sales)) throw new Error("Sales report failed");
  console.log("[PASS] Sales report.");

  // 3. Top Products
  console.log("Testing getTopProductsReport...");
  const topProducts = await reportService.getTopProductsReport(filters);
  if (!Array.isArray(topProducts)) throw new Error("Top products failed");
  console.log("[PASS] Top products report.");

  // 4. Margins
  console.log("Testing getMarginReport...");
  const margins = await reportService.getMarginReport(filters);
  if (!Array.isArray(margins)) throw new Error("Margin report failed");
  console.log("[PASS] Margin report.");

  // 5. Goals and Commissions
  console.log("Testing getGoalsAndCommissionsReport...");
  const goalsComms = await reportService.getGoalsAndCommissionsReport(filters);
  if (!Array.isArray(goalsComms)) throw new Error("Goals/Comms report failed");
  console.log("[PASS] Goals and commissions report.");

  // 6. Returns
  console.log("Testing getReturnsReport...");
  const returns = await reportService.getReturnsReport(filters);
  if (typeof returns.totalReturned !== "number") throw new Error("Returns report failed");
  console.log("[PASS] Returns report.");

  // 7. Customer Credits
  console.log("Testing getCustomerCreditsReport...");
  const credits = await reportService.getCustomerCreditsReport(filters);
  if (typeof credits.totalBalance !== "number") throw new Error("Customer credits report failed");
  console.log("[PASS] Customer credits report.");

  console.log("==================================================");
  console.log("ALL PHASE 6H COMMERCIAL REPORTS TESTS PASSED!");
  console.log("==================================================");
  process.exit(0);
}

runTests().catch(e => {
  console.error("\n[FAIL] Error during commercial reports tests:");
  console.error(e);
  process.exit(1);
});
