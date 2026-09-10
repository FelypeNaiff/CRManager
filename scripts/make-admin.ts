import { PrismaClient } from '@prisma/client';
import {
  sanitizeAdminDatabaseError,
  withDestructiveAdminDatabase,
} from '../src/lib/database/admin-script-access';

export async function main(prisma: PrismaClient) {
  const user = await prisma.user.findFirst();

  if (user && user.roleId) {
    await prisma.role.update({
      where: { id: user.roleId },
      data: { isAdmin: true }
    });
    console.log('Role updated to admin.');
  } else {
    console.log('No user with a roleId found.');
  }
}

if (require.main === module) {
  withDestructiveAdminDatabase(
    prisma => main(prisma),
    { allowProductionDestructive: true },
  ).catch(error => {
    console.error('Admin promotion failed:', sanitizeAdminDatabaseError(error));
    process.exitCode = 1;
  });
}
