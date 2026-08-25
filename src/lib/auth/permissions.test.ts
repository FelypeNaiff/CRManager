import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAuthorizationHelpersForTesting,
  type SystemAction,
  type SystemModule,
} from './permissions';
import {
  ServerAuthError,
  type ServerAuthContext,
} from './server-auth-context';

function trustedContext(overrides: Partial<ServerAuthContext> = {}): ServerAuthContext {
  return {
    authUserId: 'supabase-user-id',
    userId: 'neex-user-id',
    companyId: 'company-id',
    name: 'Admin',
    email: 'admin@example.com',
    roleId: 'role-id',
    roleName: 'Administrador',
    isAdmin: false,
    permissions: {},
    ...overrides,
  };
}

async function expectAccessDenied(operation: () => Promise<unknown>) {
  await assert.rejects(
    operation,
    (error: unknown) =>
      error instanceof ServerAuthError && error.code === 'ACCESS_NOT_ALLOWED'
  );
}

test('forged cookie isAdmin does not grant admin access', async () => {
  const forgedCookie = { isAdmin: true };
  const helpers = createAuthorizationHelpersForTesting(async () => trustedContext());

  await expectAccessDenied(() => helpers.requireAdmin());
  assert.equal(forgedCookie.isAdmin, true);
});

test('forged cookie permissions do not grant access', async () => {
  const forgedCookie = { permissions: { 'CLIENTES:DELETE': true } };
  const helpers = createAuthorizationHelpersForTesting(async () => trustedContext());

  await expectAccessDenied(() =>
    helpers.requirePermission('CLIENTES' as SystemModule, 'DELETE' as SystemAction)
  );
  assert.equal(forgedCookie.permissions['CLIENTES:DELETE'], true);
});

test('forged companyId and userId do not influence returned context', async () => {
  const forgedCookie = { companyId: 'forged-company', userId: 'forged-user' };
  const helpers = createAuthorizationHelpersForTesting(async () => trustedContext());

  const context = await helpers.requireAuth();
  assert.equal(context.companyId, 'company-id');
  assert.equal(context.userId, 'neex-user-id');
  assert.notEqual(context.companyId, forgedCookie.companyId);
  assert.notEqual(context.userId, forgedCookie.userId);
});

test('real Prisma-derived admin passes', async () => {
  const helpers = createAuthorizationHelpersForTesting(async () =>
    trustedContext({ isAdmin: true })
  );

  const context = await helpers.requireAdmin();
  assert.equal(context.isAdmin, true);
});

test('allowed permission passes', async () => {
  const helpers = createAuthorizationHelpersForTesting(async () =>
    trustedContext({ permissions: { 'CLIENTES:VIEW': true } })
  );

  const context = await helpers.requirePermission(
    'CLIENTES' as SystemModule,
    'VIEW' as SystemAction
  );
  assert.equal(context.userId, 'neex-user-id');
});

test('missing or false permission fails', async () => {
  const helpers = createAuthorizationHelpersForTesting(async () => trustedContext());

  await expectAccessDenied(() =>
    helpers.requirePermission('CLIENTES' as SystemModule, 'UPDATE' as SystemAction)
  );
});

test('any permission requires at least one allowed permission', async () => {
  const helpers = createAuthorizationHelpersForTesting(async () =>
    trustedContext({ permissions: { 'CLIENTES:VIEW': true } })
  );

  await helpers.requireAnyPermission([
    { module: 'CLIENTES' as SystemModule, action: 'DELETE' as SystemAction },
    { module: 'CLIENTES' as SystemModule, action: 'VIEW' as SystemAction },
  ]);
});

test('all permissions require every permission', async () => {
  const helpers = createAuthorizationHelpersForTesting(async () =>
    trustedContext({ permissions: { 'CLIENTES:VIEW': true } })
  );

  await expectAccessDenied(() =>
    helpers.requireAllPermissions([
      { module: 'CLIENTES' as SystemModule, action: 'VIEW' as SystemAction },
      { module: 'CLIENTES' as SystemModule, action: 'UPDATE' as SystemAction },
    ])
  );
});

test('unauthenticated resolver failure is propagated', async () => {
  const helpers = createAuthorizationHelpersForTesting(async () => {
    throw new ServerAuthError('UNAUTHENTICATED');
  });

  await assert.rejects(
    () => helpers.requireAuth(),
    (error: unknown) =>
      error instanceof ServerAuthError && error.code === 'UNAUTHENTICATED'
  );
});
