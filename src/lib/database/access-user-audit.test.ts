import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import type { Prisma } from '@prisma/client'

import {
  formatAccessAudit,
  requireAuditUserEmail,
  runAccessAudit,
} from '../../../scripts/audit-access-user'
import { requireExpectedCompanyId } from '../../../scripts/import-admin-access'
import { resolveAdminDatabaseAccess } from './admin-script-access'

const scriptPath = path.join(process.cwd(), 'scripts/audit-access-user.ts')

test('audit requires explicit administrative database configuration without runtime fallback', () => {
  assert.throws(
    () => resolveAdminDatabaseAccess(
      { mode: 'read-only' },
      { DATABASE_URL: 'postgresql://runtime.invalid/db', ADMIN_DATABASE_ENVIRONMENT: 'production' },
    ),
    /ADMIN_DATABASE_URL is required/,
  )
})

test('audit requires an explicit administrative company', () => {
  assert.throws(() => requireExpectedCompanyId({}), /ADMIN_COMPANY_ID is required/)
})

test('audit validates and normalizes its email filter', () => {
  assert.throws(() => requireAuditUserEmail({}), /AUDIT_USER_EMAIL is required/)
  assert.throws(() => requireAuditUserEmail({ AUDIT_USER_EMAIL: 'invalid' }), /valid email/)
  assert.equal(
    requireAuditUserEmail({ AUDIT_USER_EMAIL: '  Audit.User@Example.COM  ' }),
    'audit.user@example.com',
  )
})

test('audit is tenant scoped and derives authority only from the stored Role', async () => {
  let query: unknown
  const database = {
    user: {
      async findFirst(args: unknown) {
        query = args
        return {
          status: 'ACTIVE',
          companyId: 'company-a',
          company: { id: 'company-a' },
          role: { name: 'Administrador', isAdmin: true },
        }
      },
    },
  } as unknown as Prisma.TransactionClient

  const output: string[] = []
  const result = await runAccessAudit(
    database,
    'company-a',
    'audit.user@example.com',
    line => output.push(line),
  )

  assert.deepEqual(query, {
    where: { companyId: 'company-a', email: 'audit.user@example.com' },
    select: {
      status: true,
      companyId: true,
      company: { select: { id: true } },
      role: { select: { name: true, isAdmin: true } },
    },
  })
  assert.equal(result.isAdmin, true)
  assert.equal(result.expectedFlow, '/dashboard')
  assert.doesNotMatch(output.join('\n'), /audit\.user@example\.com|company-a/)
})

test('operational flow and missing relationships are reported without unnecessary PII', async () => {
  const operational = formatAccessAudit({
    userFound: true,
    active: true,
    companyMatches: true,
    roleFound: true,
    roleName: 'Operacional',
    isAdmin: false,
    expectedFlow: '/selecionar-perfil',
  }).join('\n')
  const missing = formatAccessAudit({
    userFound: false,
    active: false,
    companyMatches: false,
    roleFound: false,
    roleName: null,
    isAdmin: null,
    expectedFlow: null,
  }).join('\n')

  assert.match(operational, /fluxo esperado: \/selecionar-perfil/)
  assert.doesNotMatch(`${operational}\n${missing}`, /@|pin|password|token|secret|[0-9a-f]{8}-[0-9a-f-]{27}/i)
})

test('script import is inert and execution uses only the read-only administrative wrapper', () => {
  const source = readFileSync(scriptPath, 'utf8')

  assert.match(source, /if\s*\(require\.main\s*===\s*module\)/)
  assert.match(source, /withReadOnlyAdminDatabase/)
  assert.doesNotMatch(source, /withDestructiveAdminDatabase|new\s+PrismaClient\s*\(/)
  assert.doesNotMatch(source, /process\.env\.(?:DATABASE_URL|DIRECT_URL)/)
  assert.doesNotMatch(source, /\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/)
})
