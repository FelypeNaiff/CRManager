import assert from 'node:assert/strict';
import test from 'node:test';
import { createSessionHandler, createAdminMigrationHandlers } from './api-handlers';
import { ServerAuthError, type ServerAuthContext } from './server-auth-context';
import { executeLogout } from './session-logout';
import { decideRequest, isPublicApi } from './middleware-policy';

function trustedContext(overrides: Partial<ServerAuthContext> = {}): ServerAuthContext {
  return {
    authUserId: 'auth-id', userId: 'user-id', companyId: 'company-id', name: 'User',
    email: 'user@example.test', roleId: 'role-id', roleName: 'User', isAdmin: false,
    permissions: {}, ...overrides,
  };
}

test('session API returns 401 without Supabase identity', async () => {
  const response = await createSessionHandler(async () => { throw new ServerAuthError('UNAUTHENTICATED'); })();
  assert.equal(response.status, 401);
});

test('session API returns trusted UX context', async () => {
  const response = await createSessionHandler(async () => trustedContext())();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.session.userId, 'user-id');
});

test('session API returns 403 for invalid NEEX context', async () => {
  const response = await createSessionHandler(async () => { throw new ServerAuthError('INVALID_CONTEXT'); })();
  assert.equal(response.status, 403);
});

test('forged cookie values do not influence session API response', async () => {
  const forged = { userId: 'forged', companyId: 'forged', isAdmin: true };
  const body = await (await createSessionHandler(async () => trustedContext())()).json();
  assert.notEqual(body.session.userId, forged.userId);
  assert.notEqual(body.session.companyId, forged.companyId);
  assert.equal(body.session.isAdmin, false);
});

function adminHandlers(authorize: () => Promise<unknown>) {
  return createAdminMigrationHandlers({ authorize, migrate: async () => ({ ok: true }), counts: async () => [0, 0, 0, 0, 0] });
}

test('admin API returns 401 without authentication', async () => {
  assert.equal((await adminHandlers(async () => { throw new ServerAuthError('UNAUTHENTICATED'); }).GET()).status, 401);
});

test('admin API returns 403 for non-admin and forged isAdmin', async () => {
  const forgedCookie = { isAdmin: true };
  const response = await adminHandlers(async () => { throw new ServerAuthError('ACCESS_NOT_ALLOWED'); }).POST();
  assert.equal(forgedCookie.isAdmin, true);
  assert.equal(response.status, 403);
});

test('admin API allows Prisma-authorized admin', async () => {
  assert.equal((await adminHandlers(async () => trustedContext({ isAdmin: true })).GET()).status, 200);
});

test('logout signs out Supabase and deletes selector', async () => {
  let signedOut = 0;
  let deleted = 0;
  const dependencies = { signOut: async () => { signedOut++; }, deleteSelector: async () => { deleted++; } };
  await executeLogout(dependencies);
  await executeLogout(dependencies);
  assert.equal(signedOut, 2);
  assert.equal(deleted, 2);
});

test('logout deletes selector even when Supabase signOut fails', async () => {
  let deleted = false;
  const result = await executeLogout({
    signOut: async () => { throw new Error('hidden'); },
    deleteSelector: async () => { deleted = true; },
  });
  assert.equal(result.success, true);
  assert.equal(deleted, true);
});

test('middleware exposes only declared public APIs', () => {
  assert.equal(isPublicApi('/api/auth/login'), true);
  assert.equal(isPublicApi('/api/brasilapi/cep/01001000'), true);
  assert.equal(isPublicApi('/api/brasilapi/cnpj/123'), true);
  assert.equal(isPublicApi('/api/admin/migrate-wallet'), false);
});

test('middleware routes pages based on identity and selector', () => {
  assert.equal(decideRequest({ pathname: '/dashboard', hasSupabaseIdentity: false, hasValidSelector: false }), 'login');
  assert.equal(decideRequest({ pathname: '/dashboard', hasSupabaseIdentity: true, hasValidSelector: false }), 'select-profile');
  assert.equal(decideRequest({ pathname: '/dashboard', hasSupabaseIdentity: true, hasValidSelector: true }), 'allow');
  assert.equal(decideRequest({ pathname: '/selecionar-perfil', hasSupabaseIdentity: false, hasValidSelector: false }), 'login');
  assert.equal(decideRequest({ pathname: '/selecionar-perfil', hasSupabaseIdentity: true, hasValidSelector: false }), 'allow');
  assert.equal(decideRequest({ pathname: '/selecionar-perfil', hasSupabaseIdentity: true, hasValidSelector: true }), 'dashboard');
});

test('protected API is denied without identity or selector', () => {
  assert.equal(decideRequest({ pathname: '/api/admin/migrate-wallet', hasSupabaseIdentity: false, hasValidSelector: false }), 'api-401');
  assert.equal(decideRequest({ pathname: '/api/admin/migrate-wallet', hasSupabaseIdentity: true, hasValidSelector: false }), 'api-403');
});
