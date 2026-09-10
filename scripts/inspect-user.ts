import type { Prisma } from '@prisma/client'
import { sanitizeAdminDatabaseError, withReadOnlyAdminDatabase } from '../src/lib/database/admin-script-access'
import { requireExpectedCompanyId } from './import-admin-access'

export async function run(prisma: Prisma.TransactionClient, companyId: string, userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
    include: {
      role: { include: { permissions: true } }
    }
  })
  console.log('\n=== USER FOUND ===')
  console.log('found:', Boolean(user))
  console.log('status:', user?.status)
  console.log('permitirAcesso:', user?.permitirAcesso)
  console.log('role.name:', user?.role?.name)
  console.log('permissions count:', user?.role?.permissions?.length ?? 0)
}

if (require.main === module) {
  const userId = process.env.ADMIN_USER_ID?.trim()
  if (!userId) {
    console.error('ADMIN_USER_ID is required.')
    process.exitCode = 1
  } else {
    void withReadOnlyAdminDatabase(prisma => run(prisma, requireExpectedCompanyId(), userId))
      .catch(error => {
        console.error(sanitizeAdminDatabaseError(error))
        process.exitCode = 1
      })
  }
}
