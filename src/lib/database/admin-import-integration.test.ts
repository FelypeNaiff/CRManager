import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import {
  getImportMode,
  requireAdministrativeActorId,
  requireExpectedCompanyId,
} from '../../../scripts/import-admin-access'

const repositoryRoot = process.cwd()
const read = (relativePath: string) => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')

test('runtime DATABASE_URL cannot select write mode or tenant implicitly', () => {
  const environment = { DATABASE_URL: 'postgresql://runtime-only' }
  assert.equal(getImportMode(environment), 'preview')
  assert.throws(() => requireExpectedCompanyId(environment), /ADMIN_COMPANY_ID/)
  assert.throws(() => requireAdministrativeActorId(environment), /ADMIN_ACTOR_USER_ID/)
})

test('write mode and administrative identities require explicit variables', () => {
  const environment = {
    IMPORT_MODE: 'write',
    ADMIN_COMPANY_ID: 'tenant-a',
    ADMIN_ACTOR_USER_ID: 'actor-a',
  }
  assert.equal(getImportMode(environment), 'write')
  assert.equal(requireExpectedCompanyId(environment), 'tenant-a')
  assert.equal(requireAdministrativeActorId(environment), 'actor-a')
})

const importers = [
  'scripts/import-crm-data.ts',
  'scripts/import-financial-data.ts',
  'scripts/import-products-data.ts',
  'scripts/import-sellers-data.ts',
]

for (const scriptPath of importers) {
  test(`${scriptPath} uses the protected preview/write runner and is inert on import`, () => {
    const source = read(scriptPath)
    assert.match(source, /runProtectedImport/)
    assert.match(source, /assertExpectedCompany/)
    assert.match(source, /if\s*\(require\.main\s*===\s*module\)/)
    assert.doesNotMatch(source, /new\s+PrismaClient\s*\(/)
    assert.doesNotMatch(source, /process\.env\.(?:DATABASE_URL|DIRECT_URL)/)
  })
}

test('shared import runner requires explicit tenant, write opt-in and administrative access', () => {
  const source = read('scripts/import-admin-access.ts')
  assert.match(source, /ADMIN_COMPANY_ID/)
  assert.match(source, /CONFIRM_IMPORT/)
  assert.match(source, /withReadOnlyAdminDatabase/)
  assert.match(source, /withDestructiveAdminDatabase/)
  assert.match(source, /allowProductionDestructive:\s*true/)
  assert.match(source, /sanitizeAdminDatabaseError/)
  assert.doesNotMatch(source, /process\.env\.(?:DATABASE_URL|DIRECT_URL)/)
})

test('administrative data migration is explicit, destructive and inert on import', () => {
  const source = read('scripts/run-migration.ts')
  assert.match(source, /withDestructiveAdminDatabase/)
  assert.match(source, /requireAdministrativeActorId/)
  assert.match(source, /if\s*\(require\.main\s*===\s*module\)/)
  assert.match(source, /sanitizeAdminDatabaseError/)
  assert.doesNotMatch(source, /@\/lib\/prisma|src\/lib\/prisma/)
  assert.doesNotMatch(source, /new\s+PrismaClient\s*\(/)
})

test('validate-imports preview cannot launch importer subprocesses', () => {
  const source = read('scripts/validate-imports.ts')
  assert.match(source, /runProtectedImport/)
  assert.match(source, /executeImports/)
  assert.match(source, /if\s*\(require\.main\s*===\s*module\)/)
  assert.doesNotMatch(source, /execSync|child_process/)
  assert.doesNotMatch(source, /new\s+PrismaClient\s*\(/)
  assert.doesNotMatch(source, /process\.env\.(?:DATABASE_URL|DIRECT_URL)/)
})
