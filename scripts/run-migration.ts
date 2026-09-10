import { MigrationService } from "../src/lib/wallet/migration-service";
import type { PrismaClient } from '@prisma/client';
import {
  sanitizeAdminDatabaseError,
  withDestructiveAdminDatabase,
} from '../src/lib/database/admin-script-access';
import {
  assertExpectedCompany,
  requireAdministrativeActorId,
  requireExpectedCompanyId,
} from './import-admin-access';

// This is an administrative data migration, not a Prisma schema migration.
// Its reconciliation checks make repeated runs partially idempotent, but there is
// no durable migration marker; always review the target and result before reruns.
export async function runHistoricalWalletMigration(
  prisma: PrismaClient,
  companyId: string,
  actorUserId: string,
) {
  await assertExpectedCompany(prisma, companyId);
  return MigrationService.migrateHistoricalData(companyId, actorUserId, prisma);
}

if (require.main === module) {
  void withDestructiveAdminDatabase(
    prisma => runHistoricalWalletMigration(
      prisma,
      requireExpectedCompanyId(),
      requireAdministrativeActorId(),
    ),
    { allowProductionDestructive: true },
  )
    .then(result => console.log('Administrative data migration completed.', result))
    .catch(error => {
      console.error(sanitizeAdminDatabaseError(error));
      process.exitCode = 1;
    });
}
