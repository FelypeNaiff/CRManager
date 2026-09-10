import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAdminDatabaseAccess, sanitizeAdminDatabaseError } from './admin-script-access'

const adminUrl = 'postgresql://admin:secret@admin.invalid:5432/postgres'

test('ADMIN_DATABASE_URL is mandatory and DATABASE_URL is never a fallback', () => {
  assert.throws(
    () => resolveAdminDatabaseAccess({ mode: 'read-only' }, { DATABASE_URL: adminUrl }),
    /ADMIN_DATABASE_URL is required/,
  )
})

test('read-only access resolves only the explicit administrative target', () => {
  const access = resolveAdminDatabaseAccess(
    { mode: 'read-only' },
    { ADMIN_DATABASE_URL: adminUrl, ADMIN_DATABASE_ENVIRONMENT: 'staging' },
  )

  assert.equal(access.url, adminUrl)
  assert.equal(access.environment, 'staging')
  assert.equal(access.production, false)
  assert.equal(access.mode, 'read-only')
})

test('destructive access fails closed without exact confirmation', () => {
  assert.throws(
    () =>
      resolveAdminDatabaseAccess(
        { mode: 'destructive' },
        { ADMIN_DATABASE_URL: adminUrl, ADMIN_DATABASE_ENVIRONMENT: 'staging' },
      ),
    /confirmation is required/,
  )
})

test('unknown administrative environments fail closed', () => {
  assert.throws(
    () =>
      resolveAdminDatabaseAccess(
        { mode: 'read-only' },
        { ADMIN_DATABASE_URL: adminUrl, ADMIN_DATABASE_ENVIRONMENT: 'custom' },
      ),
    /not recognized/,
  )
})

test('destructive production access requires environment and call-site opt-ins', () => {
  const environment = {
    ADMIN_DATABASE_URL: adminUrl,
    ADMIN_DATABASE_ENVIRONMENT: 'production',
    ADMIN_DATABASE_CONFIRMATION: 'I_UNDERSTAND_THIS_WILL_MODIFY_DATA',
    ALLOW_PRODUCTION_ADMIN_DATABASE: 'true',
  }

  assert.throws(
    () => resolveAdminDatabaseAccess({ mode: 'destructive' }, environment),
    /production access is disabled/,
  )
  assert.equal(
    resolveAdminDatabaseAccess(
      { mode: 'destructive', allowProductionDestructive: true },
      environment,
    ).production,
    true,
  )
})

test('runtime production markers cannot be hidden by a local target label', () => {
  assert.throws(
    () =>
      resolveAdminDatabaseAccess(
        { mode: 'destructive' },
        {
          ADMIN_DATABASE_URL: adminUrl,
          ADMIN_DATABASE_ENVIRONMENT: 'local',
          NODE_ENV: 'production',
          ADMIN_DATABASE_CONFIRMATION: 'I_UNDERSTAND_THIS_WILL_MODIFY_DATA',
        },
      ),
    /production access is disabled/,
  )
})

test('database URLs and password assignments are sanitized from errors', () => {
  const sanitized = sanitizeAdminDatabaseError(
    new Error('failed postgresql://user:secret@host:5432/db password=secret'),
  )

  assert.equal(sanitized.includes('secret'), false)
  assert.match(sanitized, /REDACTED_DATABASE_URL/)
  assert.match(sanitized, /password=\[REDACTED\]/)
})
