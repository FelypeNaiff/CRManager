import { Prisma, PrismaClient } from '@prisma/client'

export type AdminDatabaseMode = 'read-only' | 'destructive'

export interface AdminDatabaseAccessOptions {
  mode: AdminDatabaseMode
  allowProductionDestructive?: boolean
}

export interface AdminDatabaseAccess {
  url: string
  environment: string
  production: boolean
  mode: AdminDatabaseMode
}

type AdminDatabaseEnvironment = Readonly<Record<string, string | undefined>>

const DESTRUCTIVE_CONFIRMATION = 'I_UNDERSTAND_THIS_WILL_MODIFY_DATA'
const KNOWN_ENVIRONMENTS = new Set(['local', 'development', 'test', 'staging', 'preview', 'production'])

export function resolveAdminDatabaseAccess(
  options: AdminDatabaseAccessOptions,
  environment: AdminDatabaseEnvironment = process.env,
): AdminDatabaseAccess {
  const url = environment.ADMIN_DATABASE_URL?.trim()
  if (!url) {
    throw new Error('ADMIN_DATABASE_URL is required; runtime DATABASE_URL fallback is forbidden.')
  }

  const targetEnvironment = environment.ADMIN_DATABASE_ENVIRONMENT?.trim().toLowerCase()
  if (!targetEnvironment) {
    throw new Error('ADMIN_DATABASE_ENVIRONMENT is required.')
  }
  if (!KNOWN_ENVIRONMENTS.has(targetEnvironment)) {
    throw new Error('ADMIN_DATABASE_ENVIRONMENT is not recognized.')
  }

  const production =
    targetEnvironment === 'production' ||
    environment.NODE_ENV === 'production' ||
    environment.VERCEL_ENV === 'production'
  if (options.mode === 'destructive') {
    if (environment.ADMIN_DATABASE_CONFIRMATION !== DESTRUCTIVE_CONFIRMATION) {
      throw new Error('Explicit destructive-operation confirmation is required.')
    }

    if (
      production &&
      (!options.allowProductionDestructive || environment.ALLOW_PRODUCTION_ADMIN_DATABASE !== 'true')
    ) {
      throw new Error('Destructive production access is disabled.')
    }
  }

  return { url, environment: targetEnvironment, production, mode: options.mode }
}

export function createAdminPrismaClient(access: AdminDatabaseAccess): PrismaClient {
  return new PrismaClient({ datasourceUrl: access.url, log: ['error'] })
}

export async function withReadOnlyAdminDatabase<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  environment: AdminDatabaseEnvironment = process.env,
): Promise<T> {
  const access = resolveAdminDatabaseAccess({ mode: 'read-only' }, environment)
  const client = createAdminPrismaClient(access)

  try {
    return await client.$transaction(async transaction => {
      await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY')
      const state = await transaction.$queryRaw<Array<{ readOnly: string }>>`
        SELECT current_setting('transaction_read_only') AS "readOnly"
      `

      if (state[0]?.readOnly !== 'on') {
        throw new Error('Read-only transaction enforcement failed.')
      }

      return operation(transaction)
    })
  } finally {
    await client.$disconnect()
  }
}

export function sanitizeAdminDatabaseError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Administrative database operation failed.'

  return message
    .replace(/postgres(?:ql)?:\/\/[^\s'"`]+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/(password|passwd|pwd)\s*[=:]\s*[^\s,;]+/gi, '$1=[REDACTED]')
}
