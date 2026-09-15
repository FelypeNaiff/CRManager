import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import { resolveAuditActor } from './audit-actor';
import { sanitizeAuditDetails, sanitizeAuditMetadata } from './audit-sanitization';
import { writeActivityLog } from './activity-log';
import type { ServerAuthContext } from './server-auth-context';

function context(overrides: Partial<ServerAuthContext> = {}): ServerAuthContext {
  return {
    authUserId: 'supabase-base', authenticatedUserId: 'base-user', userId: 'base-user',
    companyId: 'company-a', name: 'Felype', email: 'user@example.test', roleId: 'role-a',
    roleName: 'Administrador', isAdmin: true, permissions: {}, ...overrides,
  };
}

function transaction(create: (args: any) => Promise<unknown>): Prisma.TransactionClient {
  return { activityLog: { create } } as unknown as Prisma.TransactionClient;
}

test('direct admin resolves the same authenticated and actor User', () => {
  const actor = resolveAuditActor(context());
  assert.equal(actor.authenticatedUserId, actor.actorUserId);
});

test('shared account resolves selected profile as a distinct actor', () => {
  const actor = resolveAuditActor(context({ userId: 'kathucia', name: 'KATHUCIA' }));
  assert.equal(actor.authenticatedUserId, 'base-user');
  assert.equal(actor.actorUserId, 'kathucia');
});

test('audit actor preserves effective Role and base tenant', () => {
  const actor = resolveAuditActor(context({ userId: 'profile-a', roleId: 'operator', roleName: 'Operador' }));
  assert.deepEqual(
    { companyId: actor.companyId, roleId: actor.roleId, roleName: actor.roleName },
    { companyId: 'company-a', roleId: 'operator', roleName: 'Operador' },
  );
});

test('client actor and authenticated IDs are not accepted by audit input', async () => {
  let written: any;
  const forged = { actorUserId: 'attacker', authenticatedUserId: 'attacker', companyId: 'company-b' };
  await writeActivityLog(
    { context: context({ userId: 'profile-a' }), action: 'UPDATE', module: 'CUSTOMER', metadata: forged },
    { policy: 'CRITICAL', tx: transaction(async ({ data }) => { written = data; }) },
  );
  assert.equal(written.companyId, 'company-a');
  assert.equal(written.actorUserId, 'profile-a');
  assert.equal(written.authenticatedUserId, 'base-user');
});

test('critical audit uses the supplied transaction client', async () => {
  let calls = 0;
  await writeActivityLog(
    { context: context(), action: 'UPDATE', module: 'ROLE' },
    { policy: 'CRITICAL', tx: transaction(async () => { calls++; }) },
  );
  assert.equal(calls, 1);
});

test('critical audit propagates failure for transaction rollback', async () => {
  await assert.rejects(
    writeActivityLog(
      { context: context(), action: 'UPDATE', module: 'ROLE' },
      { policy: 'CRITICAL', tx: transaction(async () => { throw new Error('write failed'); }) },
    ),
    /write failed/,
  );
});

test('best-effort audit is explicit and reports failure', async () => {
  const originalError = console.error;
  console.error = () => undefined;
  try {
    const result = await writeActivityLog(
      { context: context(), action: 'VIEW', module: 'SYSTEM' },
      { policy: 'BEST_EFFORT', tx: transaction(async () => { throw new Error('write failed'); }) },
    );
    assert.equal(result, false);
  } finally {
    console.error = originalError;
  }
});

test('metadata recursively removes PINs and hashes', () => {
  const value = sanitizeAuditMetadata({ pin: '1234', nested: { pinAccessHash: 'hash', authorizationPinHash: 'hash2' } });
  assert.deepEqual(value, {
    pin: '[REDACTED]',
    nested: { pinAccessHash: '[REDACTED]', authorizationPinHash: '[REDACTED]' },
  });
});

test('metadata recursively removes passwords, tokens, secrets and API keys', () => {
  const value = sanitizeAuditMetadata({ password: 'x', access_token: 'y', nested: { secret: 'z', apiKey: 'k' } });
  assert.deepEqual(value, {
    password: '[REDACTED]', access_token: '[REDACTED]',
    nested: { secret: '[REDACTED]', apiKey: '[REDACTED]' },
  });
});

test('normal metadata and safe details remain available', () => {
  assert.deepEqual(sanitizeAuditMetadata({ before: { status: 'ACTIVE' }, after: { status: 'INACTIVE' } }), {
    before: { status: 'ACTIVE' }, after: { status: 'INACTIVE' },
  });
  assert.equal(sanitizeAuditDetails('Status alterado'), 'Status alterado');
});

test('sensitive values embedded in details are redacted', () => {
  const details = sanitizeAuditDetails('PIN: 1234; token=abc; senha xyz');
  assert.doesNotMatch(details!, /1234|abc|xyz/);
});

test('schema preserves physical user_id for the effective actor', () => {
  const schema = readFileSync(new URL('../../../prisma/schema.prisma', import.meta.url), 'utf8');
  assert.match(schema, /actorUserId\s+String\s+@map\("user_id"\)/);
  assert.match(schema, /authenticatedUserId\s+String\s+@map\("authenticated_user_id"\)/);
  assert.match(schema, /metadata\s+Json\?/);
});

test('migration backfills the authenticated User before NOT NULL', () => {
  const sql = readFileSync(new URL('../../../prisma/migrations/20260915120000_add_audit_actor_context/migration.sql', import.meta.url), 'utf8');
  const backfill = sql.indexOf('SET "authenticated_user_id" = "user_id"');
  const notNull = sql.indexOf('ALTER COLUMN "authenticated_user_id" SET NOT NULL');
  assert.ok(backfill >= 0 && notNull > backfill);
});

test('migration preserves ActivityLog and physical user_id', () => {
  const sql = readFileSync(new URL('../../../prisma/migrations/20260915120000_add_audit_actor_context/migration.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /DROP\s+(TABLE|COLUMN)[^;]*(activity_logs|user_id)/i);
  assert.doesNotMatch(sql, /migrate deploy|db push|DATABASE_URL/i);
});
