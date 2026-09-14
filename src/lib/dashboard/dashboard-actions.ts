'use server';

import { requireAuth } from '@/lib/auth/permissions';
import { getActiveCustomersCount } from '@/lib/crm/actions';
import {
  getFinancialDashboardSummary,
  getFinancialTransactions,
} from '@/lib/financial/financial-actions';
import { getDashboardMetricsAction } from '@/lib/reports/actions/commercial-report-actions';
import { listSalesAction } from '@/lib/sales/actions/list-sales-action';

interface MainDashboardInput {
  startOfToday: Date;
  endOfToday: Date;
  sixMonthsAgo: string;
  sevenDaysAgo: Date;
}

export async function getMainDashboardDataAction(input: MainDashboardInput) {
  const auth = await requireAuth();

  const [activeCustomers, financialSummary, todayMetrics, transactions, recentSales] =
    await Promise.all([
      getActiveCustomersCount(),
      getFinancialDashboardSummary(),
      getDashboardMetricsAction({
        companyId: auth.companyId,
        startDate: input.startOfToday,
        endDate: input.endOfToday,
      }),
      getFinancialTransactions({ startDate: input.sixMonthsAgo }),
      listSalesAction(auth.companyId, { startDate: input.sevenDaysAgo }),
    ]);

  return { activeCustomers, financialSummary, todayMetrics, transactions, recentSales };
}
