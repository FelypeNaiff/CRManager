import { MigrationService } from '@/lib/wallet/migration-service';
import { requireAdmin } from '@/lib/auth/permissions';
import { createAdminMigrationHandlers } from '@/lib/auth/api-handlers';

const handlers = createAdminMigrationHandlers({
  authorize: requireAdmin,
  migrate: () => MigrationService.migrateHistoricalData(),
  async counts() {
    const { prisma } = await import('@/lib/prisma');
    return Promise.all([
      prisma.exchangeReturn.count(), prisma.customerWalletMovement.count(),
      prisma.saleExchange.count(), prisma.saleReturn.count(), prisma.walletTransaction.count(),
    ]);
  },
});

export const GET = handlers.GET;
export const POST = handlers.POST;
