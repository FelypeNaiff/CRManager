import type { Prisma } from '@prisma/client'

import {
  sanitizeAdminDatabaseError,
  withReadOnlyAdminDatabase,
} from '../src/lib/database/admin-script-access'
import { requireExpectedCompanyId } from './import-admin-access'

type AuditEnvironment = Readonly<Record<string, string | undefined>>

export interface AccessAuditResult {
  userFound: boolean
  active: boolean
  companyMatches: boolean
  roleFound: boolean
  roleName: string | null
  isAdmin: boolean | null
  expectedFlow: '/dashboard' | '/selecionar-perfil' | null
}

const BASIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function requireAuditUserEmail(environment: AuditEnvironment = process.env): string {
  const email = environment.AUDIT_USER_EMAIL?.trim().toLowerCase()
  if (!email) throw new Error('AUDIT_USER_EMAIL is required.')
  if (!BASIC_EMAIL_PATTERN.test(email)) throw new Error('AUDIT_USER_EMAIL must be a valid email address.')
  return email
}

function yesNo(value: boolean): 'SIM' | 'NÃO' {
  return value ? 'SIM' : 'NÃO'
}

export function formatAccessAudit(result: AccessAuditResult): string[] {
  return [
    `user encontrado: ${yesNo(result.userFound)}`,
    `ativo: ${yesNo(result.active)}`,
    `company corresponde: ${yesNo(result.companyMatches)}`,
    `Role encontrada: ${yesNo(result.roleFound)}`,
    `nome da Role: ${result.roleName ?? 'NÃO DISPONÍVEL'}`,
    `Role.isAdmin: ${result.isAdmin === null ? 'NÃO DISPONÍVEL' : String(result.isAdmin)}`,
    `fluxo esperado: ${result.expectedFlow ?? 'NÃO DISPONÍVEL'}`,
  ]
}

export async function runAccessAudit(
  prisma: Prisma.TransactionClient,
  companyId: string,
  email: string,
  log: (line: string) => void = console.log,
): Promise<AccessAuditResult> {
  const user = await prisma.user.findFirst({
    where: { companyId, email },
    select: {
      status: true,
      companyId: true,
      company: { select: { id: true } },
      role: { select: { name: true, isAdmin: true } },
    },
  })

  const roleFound = Boolean(user?.role)
  const isAdmin = user?.role?.isAdmin ?? null
  const result: AccessAuditResult = {
    userFound: Boolean(user),
    active: user?.status.trim().toUpperCase() === 'ACTIVE' || user?.status.trim().toUpperCase() === 'ATIVO',
    companyMatches: Boolean(user?.company && user.companyId === companyId && user.company.id === companyId),
    roleFound,
    roleName: user?.role?.name ?? null,
    isAdmin,
    expectedFlow: roleFound ? (isAdmin ? '/dashboard' : '/selecionar-perfil') : null,
  }

  formatAccessAudit(result).forEach(log)
  return result
}

if (require.main === module) {
  const companyId = requireExpectedCompanyId()
  const email = requireAuditUserEmail()

  void withReadOnlyAdminDatabase(prisma => runAccessAudit(prisma, companyId, email))
    .catch(error => {
      console.error(sanitizeAdminDatabaseError(error))
      process.exitCode = 1
    })
}
