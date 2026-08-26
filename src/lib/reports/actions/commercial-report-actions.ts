'use server';

import { unstable_cache } from 'next/cache';
import { requirePermission } from '@/lib/auth/permissions';
import { CommercialReportService, type ReportFilters } from '../commercial-report-service';
import {
  fromReportCacheArguments,
  scopeReportFilters,
  toReportCacheArguments,
  type ReportCacheArguments,
} from '../report-tenant-security';

const reportService = new CommercialReportService();
type ReportLoader<T> = (filters: ReportFilters) => Promise<T>;

function createTenantSafeCache<T>(loader: ReportLoader<T>, key: string, tags: string[]) {
  return unstable_cache(
    async (...args: ReportCacheArguments): Promise<T> => loader(fromReportCacheArguments(args)),
    [key],
    { tags }
  );
}

const cachedDashboard = createTenantSafeCache(
  filters => reportService.getDashboardMetrics(filters),
  'dashboard-metrics', ['sales-reports', 'dashboard']
);
const cachedTopProducts = createTenantSafeCache(
  filters => reportService.getTopProductsReport(filters),
  'top-products-report', ['sales-reports', 'top-products']
);
const cachedMargin = createTenantSafeCache(
  filters => reportService.getMarginReport(filters),
  'margin-report', ['sales-reports', 'margin']
);
const cachedGoals = createTenantSafeCache(
  filters => reportService.getGoalsAndCommissionsReport(filters),
  'goals-commissions-report', ['sales-reports', 'goals-commissions']
);
const cachedReturns = createTenantSafeCache(
  filters => reportService.getReturnsReport(filters),
  'returns-report', ['sales-reports', 'returns']
);
const cachedCredits = createTenantSafeCache(
  filters => reportService.getCustomerCreditsReport(filters),
  'customer-credits-report', ['sales-reports', 'customer-credits']
);

async function trustedFilters(filters: ReportFilters): Promise<ReportFilters> {
  const auth = await requirePermission('RELATORIOS', 'VIEW');
  return scopeReportFilters(filters, auth);
}

async function runCachedReport<T>(
  filters: ReportFilters,
  loader: (...args: ReportCacheArguments) => Promise<T>
) {
  try {
    const scoped = await trustedFilters(filters);
    return { success: true, data: await loader(...toReportCacheArguments(scoped)) };
  } catch {
    return { success: false, error: 'Não foi possível carregar o relatório.' };
  }
}

export async function getDashboardMetricsAction(filters: ReportFilters) {
  return runCachedReport(filters, cachedDashboard);
}

export async function getSalesReportAction(filters: ReportFilters) {
  try {
    const scoped = await trustedFilters(filters);
    return { success: true, data: await reportService.getSalesReport(scoped) };
  } catch {
    return { success: false, error: 'Não foi possível carregar o relatório.' };
  }
}

export async function getTopProductsReportAction(filters: ReportFilters) {
  return runCachedReport(filters, cachedTopProducts);
}

export async function getMarginReportAction(filters: ReportFilters) {
  return runCachedReport(filters, cachedMargin);
}

export async function getGoalsAndCommissionsReportAction(filters: ReportFilters) {
  return runCachedReport(filters, cachedGoals);
}

export async function getReturnsReportAction(filters: ReportFilters) {
  return runCachedReport(filters, cachedReturns);
}

export async function getCustomerCreditsReportAction(filters: ReportFilters) {
  return runCachedReport(filters, cachedCredits);
}
