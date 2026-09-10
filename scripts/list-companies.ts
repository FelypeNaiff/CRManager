import type { Prisma } from '@prisma/client';
import { sanitizeAdminDatabaseError, withReadOnlyAdminDatabase } from '../src/lib/database/admin-script-access';

export async function main(prisma: Prisma.TransactionClient) {
  if (process.env.ADMIN_GLOBAL_SCOPE !== 'true') throw new Error('ADMIN_GLOBAL_SCOPE=true is required for global company aggregates.');
  const companies = await prisma.company.groupBy({ by: ['status'], _count: true });
  console.log(JSON.stringify(companies));
}

if (require.main === module) {
  void withReadOnlyAdminDatabase(main).catch(error => {
    console.error(sanitizeAdminDatabaseError(error));
    process.exitCode = 1;
  });
}
