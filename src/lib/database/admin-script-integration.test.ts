import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const repositoryRoot = process.cwd()

function readRepositoryFile(relativePath: string): string {
  return readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
}

for (const scriptPath of ['scripts/purge-test-data.ts']) {
  test(`${scriptPath} uses explicit destructive administrative access`, () => {
    const source = readRepositoryFile(scriptPath)

    assert.match(source, /resolveAdminDatabaseAccess/)
    assert.match(source, /mode:\s*["']destructive["']/)
    assert.match(source, /createAdminPrismaClient/)
    assert.doesNotMatch(source, /new\s+PrismaClient\s*\(/)
    assert.doesNotMatch(source, /process\.env\.(?:DATABASE_URL|DIRECT_URL)/)
  })

  test(`${scriptPath} is inert when imported`, () => {
    const source = readRepositoryFile(scriptPath)

    assert.match(source, /if\s*\(require\.main\s*===\s*module\)/)
  })
}

test('backup requires its explicit administrative URL without runtime fallbacks', () => {
  const source = readRepositoryFile('scripts/backup-db.ps1')

  assert.match(source, /\$env:ADMIN_DATABASE_URL/)
  assert.doesNotMatch(source, /\$env:(?:DATABASE_URL|DIRECT_URL)/)
  assert.doesNotMatch(source, /Get-Content\s+["']\.env["']/)
  assert.match(source, /Port\s+-eq\s+6543/)
  assert.match(source, /pgbouncer=true/)
})
