import type { Prisma, PrismaClient } from '@prisma/client'

import {
  sanitizeAdminDatabaseError,
  withDestructiveAdminDatabase,
  withReadOnlyAdminDatabase,
} from '../src/lib/database/admin-script-access'

export type ImportDatabase = PrismaClient | Prisma.TransactionClient
export type ImportMode = 'preview' | 'write'
type ImportEnvironment = Readonly<Record<string, string | undefined>>

export function getImportMode(environment: ImportEnvironment = process.env): ImportMode {
  return environment.IMPORT_MODE === 'write' ? 'write' : 'preview'
}

export function requireExpectedCompanyId(environment: ImportEnvironment = process.env): string {
  const companyId = environment.ADMIN_COMPANY_ID?.trim()
  if (!companyId) throw new Error('ADMIN_COMPANY_ID is required for tenant-scoped imports.')
  return companyId
}

export function requireAdministrativeActorId(environment: ImportEnvironment = process.env): string {
  const actorUserId = environment.ADMIN_ACTOR_USER_ID?.trim()
  if (!actorUserId) throw new Error('ADMIN_ACTOR_USER_ID is required for audited data migrations.')
  return actorUserId
}

export async function assertExpectedCompany(db: ImportDatabase, companyId: string) {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { id: true } })
  if (!company) throw new Error('The explicitly configured administrative tenant was not found.')
  return company
}

export async function runProtectedImport(options: {
  preview: (db: Prisma.TransactionClient, companyId: string) => Promise<void>
  write: (db: PrismaClient, companyId: string) => Promise<void>
}): Promise<void> {
  const mode = getImportMode()
  const companyId = requireExpectedCompanyId()

  try {
    if (mode === 'preview') {
      await withReadOnlyAdminDatabase(db => options.preview(db, companyId))
      return
    }

    if (process.env.CONFIRM_IMPORT !== 'true') {
      throw new Error('CONFIRM_IMPORT=true is required for real import execution.')
    }

    await withDestructiveAdminDatabase(
      db => options.write(db, companyId),
      { allowProductionDestructive: true },
    )
  } catch (error) {
    console.error(sanitizeAdminDatabaseError(error))
    throw error
  }
}
