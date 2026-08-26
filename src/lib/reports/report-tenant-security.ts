import type { ServerAuthContext } from '@/lib/auth/server-auth-context';
import type { ReportFilters } from './commercial-report-service';

export function scopeReportFilters(
  filters: ReportFilters,
  auth: Pick<ServerAuthContext, 'companyId'>
): ReportFilters {
  return { ...filters, companyId: auth.companyId };
}

export type ReportCacheArguments = [string, string, string, string, string, string];

export function toReportCacheArguments(filters: ReportFilters): ReportCacheArguments {
  return [
    filters.companyId,
    filters.startDate instanceof Date ? filters.startDate.toISOString() : (filters.startDate || ''),
    filters.endDate instanceof Date ? filters.endDate.toISOString() : (filters.endDate || ''),
    filters.sellerId || '',
    filters.customerId || '',
    filters.status || '',
  ];
}

export function fromReportCacheArguments(args: ReportCacheArguments): ReportFilters {
  const [companyId, startDate, endDate, sellerId, customerId, status] = args;
  return {
    companyId,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    sellerId: sellerId || undefined,
    customerId: customerId || undefined,
    status: status || undefined,
  };
}
