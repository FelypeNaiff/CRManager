'use server';
import { serializePrisma } from '@/lib/serialize';
import { CommercialReportService, ReportFilters } from "../commercial-report-service";
import { revalidatePath, unstable_cache } from "next/cache";

const reportService = new CommercialReportService();

// Wrapper caches with primitive params to avoid object key serialization collision
const getCachedDashboardMetrics = unstable_cache(
  async (
    companyId: string,
    startDateStr: string,
    endDateStr: string,
    sellerId: string,
    customerId: string,
    status: string
  ) => {
    return reportService.getDashboardMetrics({
      companyId,
      startDate: startDateStr ? new Date(startDateStr) : undefined,
      endDate: endDateStr ? new Date(endDateStr) : undefined,
      sellerId: sellerId || undefined,
      customerId: customerId || undefined,
      status: status || undefined
    });
  },
  ["dashboard-metrics"],
  { tags: ["sales-reports", "dashboard"] }
);

const getCachedTopProductsReport = unstable_cache(
  async (
    companyId: string,
    startDateStr: string,
    endDateStr: string,
    sellerId: string,
    customerId: string,
    status: string
  ) => {
    return reportService.getTopProductsReport({
      companyId,
      startDate: startDateStr ? new Date(startDateStr) : undefined,
      endDate: endDateStr ? new Date(endDateStr) : undefined,
      sellerId: sellerId || undefined,
      customerId: customerId || undefined,
      status: status || undefined
    });
  },
  ["top-products-report"],
  { tags: ["sales-reports", "top-products"] }
);

const getCachedMarginReport = unstable_cache(
  async (
    companyId: string,
    startDateStr: string,
    endDateStr: string,
    sellerId: string,
    customerId: string,
    status: string
  ) => {
    return reportService.getMarginReport({
      companyId,
      startDate: startDateStr ? new Date(startDateStr) : undefined,
      endDate: endDateStr ? new Date(endDateStr) : undefined,
      sellerId: sellerId || undefined,
      customerId: customerId || undefined,
      status: status || undefined
    });
  },
  ["margin-report"],
  { tags: ["sales-reports", "margin"] }
);

const getCachedGoalsAndCommissionsReport = unstable_cache(
  async (
    companyId: string,
    startDateStr: string,
    endDateStr: string,
    sellerId: string,
    customerId: string,
    status: string
  ) => {
    return reportService.getGoalsAndCommissionsReport({
      companyId,
      startDate: startDateStr ? new Date(startDateStr) : undefined,
      endDate: endDateStr ? new Date(endDateStr) : undefined,
      sellerId: sellerId || undefined,
      customerId: customerId || undefined,
      status: status || undefined
    });
  },
  ["goals-commissions-report"],
  { tags: ["sales-reports", "goals-commissions"] }
);

const getCachedReturnsReport = unstable_cache(
  async (
    companyId: string,
    startDateStr: string,
    endDateStr: string,
    sellerId: string,
    customerId: string,
    status: string
  ) => {
    return reportService.getReturnsReport({
      companyId,
      startDate: startDateStr ? new Date(startDateStr) : undefined,
      endDate: endDateStr ? new Date(endDateStr) : undefined,
      sellerId: sellerId || undefined,
      customerId: customerId || undefined,
      status: status || undefined
    });
  },
  ["returns-report"],
  { tags: ["sales-reports", "returns"] }
);

const getCachedCustomerCreditsReport = unstable_cache(
  async (
    companyId: string,
    startDateStr: string,
    endDateStr: string,
    sellerId: string,
    customerId: string,
    status: string
  ) => {
    return reportService.getCustomerCreditsReport({
      companyId,
      startDate: startDateStr ? new Date(startDateStr) : undefined,
      endDate: endDateStr ? new Date(endDateStr) : undefined,
      sellerId: sellerId || undefined,
      customerId: customerId || undefined,
      status: status || undefined
    });
  },
  ["customer-credits-report"],
  { tags: ["sales-reports", "customer-credits"] }
);


export async function getDashboardMetricsAction(filters: ReportFilters) {
  try {
    const data = await getCachedDashboardMetrics(
      filters.companyId,
      filters.startDate instanceof Date ? filters.startDate.toISOString() : (filters.startDate || ''),
      filters.endDate instanceof Date ? filters.endDate.toISOString() : (filters.endDate || ''),
      filters.sellerId || '',
      filters.customerId || '',
      filters.status || ''
    );
    return { success: true, data };
  } catch (error: any) {
    console.error("getDashboardMetricsAction error:", error);
    return { success: false, error: error.message || "Failed to load dashboard metrics" };
  }
}

export async function getSalesReportAction(filters: ReportFilters) {
  // Sales report list should NOT be cached as it's highly transactional / live feed
  try {
    const data = await reportService.getSalesReport(filters);
    return { success: true, data };
  } catch (error: any) {
    console.error("getSalesReportAction error:", error);
    return { success: false, error: error.message || "Failed to load sales report" };
  }
}

export async function getTopProductsReportAction(filters: ReportFilters) {
  try {
    const data = await getCachedTopProductsReport(
      filters.companyId,
      filters.startDate instanceof Date ? filters.startDate.toISOString() : (filters.startDate || ''),
      filters.endDate instanceof Date ? filters.endDate.toISOString() : (filters.endDate || ''),
      filters.sellerId || '',
      filters.customerId || '',
      filters.status || ''
    );
    return { success: true, data };
  } catch (error: any) {
    console.error("getTopProductsReportAction error:", error);
    return { success: false, error: error.message || "Failed to load top products report" };
  }
}

export async function getMarginReportAction(filters: ReportFilters) {
  try {
    const data = await getCachedMarginReport(
      filters.companyId,
      filters.startDate instanceof Date ? filters.startDate.toISOString() : (filters.startDate || ''),
      filters.endDate instanceof Date ? filters.endDate.toISOString() : (filters.endDate || ''),
      filters.sellerId || '',
      filters.customerId || '',
      filters.status || ''
    );
    return { success: true, data };
  } catch (error: any) {
    console.error("getMarginReportAction error:", error);
    return { success: false, error: error.message || "Failed to load margin report" };
  }
}

export async function getGoalsAndCommissionsReportAction(filters: ReportFilters) {
  try {
    const data = await getCachedGoalsAndCommissionsReport(
      filters.companyId,
      filters.startDate instanceof Date ? filters.startDate.toISOString() : (filters.startDate || ''),
      filters.endDate instanceof Date ? filters.endDate.toISOString() : (filters.endDate || ''),
      filters.sellerId || '',
      filters.customerId || '',
      filters.status || ''
    );
    return { success: true, data };
  } catch (error: any) {
    console.error("getGoalsAndCommissionsReportAction error:", error);
    return { success: false, error: error.message || "Failed to load goals and commissions report" };
  }
}

export async function getReturnsReportAction(filters: ReportFilters) {
  try {
    const data = await getCachedReturnsReport(
      filters.companyId,
      filters.startDate instanceof Date ? filters.startDate.toISOString() : (filters.startDate || ''),
      filters.endDate instanceof Date ? filters.endDate.toISOString() : (filters.endDate || ''),
      filters.sellerId || '',
      filters.customerId || '',
      filters.status || ''
    );
    return { success: true, data };
  } catch (error: any) {
    console.error("getReturnsReportAction error:", error);
    return { success: false, error: error.message || "Failed to load returns report" };
  }
}

export async function getCustomerCreditsReportAction(filters: ReportFilters) {
  try {
    const data = await getCachedCustomerCreditsReport(
      filters.companyId,
      filters.startDate instanceof Date ? filters.startDate.toISOString() : (filters.startDate || ''),
      filters.endDate instanceof Date ? filters.endDate.toISOString() : (filters.endDate || ''),
      filters.sellerId || '',
      filters.customerId || '',
      filters.status || ''
    );
    return { success: true, data };
  } catch (error: any) {
    console.error("getCustomerCreditsReportAction error:", error);
    return { success: false, error: error.message || "Failed to load customer credits report" };
  }
}
