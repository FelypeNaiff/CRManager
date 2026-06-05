'use server';
import { serializePrisma } from '@/lib/serialize';

import { CommercialReportService, ReportFilters } from "../commercial-report-service";
import { revalidatePath } from "next/cache";

const reportService = new CommercialReportService();

export async function getDashboardMetricsAction(filters: ReportFilters) {
  try {
    const data = await reportService.getDashboardMetrics(filters);
    return { success: true, data };
  } catch (error: any) {
    console.error("getDashboardMetricsAction error:", error);
    return { success: false, error: error.message || "Failed to load dashboard metrics" };
  }
}

export async function getSalesReportAction(filters: ReportFilters) {
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
    const data = await reportService.getTopProductsReport(filters);
    return { success: true, data };
  } catch (error: any) {
    console.error("getTopProductsReportAction error:", error);
    return { success: false, error: error.message || "Failed to load top products report" };
  }
}

export async function getMarginReportAction(filters: ReportFilters) {
  try {
    const data = await reportService.getMarginReport(filters);
    return { success: true, data };
  } catch (error: any) {
    console.error("getMarginReportAction error:", error);
    return { success: false, error: error.message || "Failed to load margin report" };
  }
}

export async function getGoalsAndCommissionsReportAction(filters: ReportFilters) {
  try {
    const data = await reportService.getGoalsAndCommissionsReport(filters);
    return { success: true, data };
  } catch (error: any) {
    console.error("getGoalsAndCommissionsReportAction error:", error);
    return { success: false, error: error.message || "Failed to load goals and commissions report" };
  }
}

export async function getReturnsReportAction(filters: ReportFilters) {
  try {
    const data = await reportService.getReturnsReport(filters);
    return { success: true, data };
  } catch (error: any) {
    console.error("getReturnsReportAction error:", error);
    return { success: false, error: error.message || "Failed to load returns report" };
  }
}

export async function getCustomerCreditsReportAction(filters: ReportFilters) {
  try {
    const data = await reportService.getCustomerCreditsReport(filters);
    return { success: true, data };
  } catch (error: any) {
    console.error("getCustomerCreditsReportAction error:", error);
    return { success: false, error: error.message || "Failed to load customer credits report" };
  }
}
