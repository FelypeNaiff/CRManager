import type { Prisma } from '@prisma/client';
import { sanitizeAdminDatabaseError, withReadOnlyAdminDatabase } from '../src/lib/database/admin-script-access';
import { requireExpectedCompanyId } from './import-admin-access';

export async function getPaymentMethodSummary(prisma: Prisma.TransactionClient, companyId: string) {
  const rows = await prisma.paymentMethod.groupBy({ by: ['type', 'isActive'], where: { companyId }, _count: true });
  console.log(JSON.stringify(rows));
}

if (require.main === module) {
  void withReadOnlyAdminDatabase(prisma => getPaymentMethodSummary(prisma, requireExpectedCompanyId()))
    .catch(error => {
      console.error(sanitizeAdminDatabaseError(error));
      process.exitCode = 1;
    });
}
