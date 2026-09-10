import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8')

const tenantScripts = [
  'scripts/audit-performance-01.ts',
  'scripts/audit-test-data.ts',
  'scripts/diagnose-go-live.ts',
  'scripts/get_payments.ts',
  'scripts/inspect-user.ts',
]

for (const scriptPath of tenantScripts) {
  test(`${scriptPath} requires protected read-only tenant access and is inert`, () => {
    const source = read(scriptPath)
    assert.match(source, /withReadOnlyAdminDatabase/)
    assert.match(source, /requireExpectedCompanyId/)
    assert.match(source, /sanitizeAdminDatabaseError/)
    assert.match(source, /if\s*\(require\.main\s*===\s*module\)/)
    assert.doesNotMatch(source, /new\s+PrismaClient\s*\(/)
    assert.doesNotMatch(source, /from\s+['"]\.\.\/src\/lib\/prisma['"]/)
    assert.doesNotMatch(source, /process\.env\.(?:DATABASE_URL|DIRECT_URL)/)
  })
}

for (const scriptPath of ['scripts/check-migrations.ts', 'scripts/list-companies.ts']) {
  test(`${scriptPath} requires explicit global scope and read-only access`, () => {
    const source = read(scriptPath)
    assert.match(source, /ADMIN_GLOBAL_SCOPE/)
    assert.match(source, /withReadOnlyAdminDatabase/)
    assert.match(source, /sanitizeAdminDatabaseError/)
    assert.match(source, /if\s*\(require\.main\s*===\s*module\)/)
    assert.doesNotMatch(source, /new\s+PrismaClient\s*\(/)
    assert.doesNotMatch(source, /process\.env\.(?:DATABASE_URL|DIRECT_URL)/)
  })
}

test('migration check omits checksums and migration logs', () => {
  const source = read('scripts/check-migrations.ts')
  assert.doesNotMatch(source, /\bchecksum\b|\blogs\b/i)
})

test('user inspection has no hardcoded identity and emits no direct identity fields', () => {
  const source = read('scripts/inspect-user.ts')
  assert.match(source, /ADMIN_USER_ID/)
  assert.doesNotMatch(source, /@gmail\.com|felypenaiff/i)
  assert.doesNotMatch(source, /console\.log\(['"](?:ID|nome|name|email|username|companyId|roleId)/i)
})

test('test ID resolver accepts only an injected read-only transaction and tenant', () => {
  const source = read('scripts/resolve-test-ids.ts')
  assert.match(source, /Prisma\.TransactionClient/)
  assert.match(source, /companyId:\s*string/)
  assert.doesNotMatch(source, /new\s+PrismaClient\s*\(/)
  assert.doesNotMatch(source, /process\.env\.(?:DATABASE_URL|DIRECT_URL)/)
})

test('test audit masks identifiers and excludes direct contact fields from reports', () => {
  const source = read('scripts/audit-test-data.ts')
  assert.match(source, /maskId/)
  assert.doesNotMatch(source, /Phone:\s*c\.phone|Email:\s*c\.email|AccountNumber:/)
})

test('backup remains on its explicit non-transaction-pooler administrative URL', () => {
  const source = read('scripts/backup-db.ps1')
  assert.match(source, /\$env:ADMIN_DATABASE_URL/)
  assert.doesNotMatch(source, /\$env:(?:DATABASE_URL|DIRECT_URL)/)
  assert.match(source, /Port\s+-eq\s+6543/)
  assert.match(source, /pgbouncer=true/)
  assert.doesNotMatch(source, /Write-Host\s+.*\$dbUrl/)
})
