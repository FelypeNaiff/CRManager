import { MigrationService } from '@/lib/wallet/migration-service';
import { requireAdmin } from '@/lib/auth/permissions';
import { createAdminMigrationHandlers } from '@/lib/auth/api-handlers';

const handlers = createAdminMigrationHandlers({
  authorize: requireAdmin,
  migrate: (auth) => MigrationService.migrateHistoricalData(auth.companyId, auth.userId),
  counts: (auth) => MigrationService.getTenantCounts(auth.companyId),
});

export const GET = handlers.GET;
export const POST = handlers.POST;
