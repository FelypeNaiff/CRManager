import type { Prisma } from '@prisma/client';
import { sanitizeAdminDatabaseError, withReadOnlyAdminDatabase } from '../src/lib/database/admin-script-access';

function requireGlobalScope() {
  if (process.env.ADMIN_GLOBAL_SCOPE !== 'true') throw new Error('ADMIN_GLOBAL_SCOPE=true is required for global migration metadata.');
}

export async function main(prisma: Prisma.TransactionClient) {
  const migrations = await prisma.$queryRaw<any[]>`
    SELECT migration_name, started_at, finished_at, rolled_back_at
    FROM _prisma_migrations 
    ORDER BY finished_at DESC 
    LIMIT 5
  `;
  console.log("Last 5 migrations in DB:", JSON.stringify(migrations, null, 2));
}

if (require.main === module) {
  try {
    requireGlobalScope();
    void withReadOnlyAdminDatabase(main).catch(error => {
      console.error(sanitizeAdminDatabaseError(error));
      process.exitCode = 1;
    });
  } catch (error) {
    console.error(sanitizeAdminDatabaseError(error));
    process.exitCode = 1;
  }
}
