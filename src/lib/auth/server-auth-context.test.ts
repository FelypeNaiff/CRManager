import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveServerAuthContextForTesting,
  ServerAuthError,
  type ServerAuthResolverDependencies,
} from './server-auth-context';

function validDependencies(): ServerAuthResolverDependencies {
  return {
    async getAuthenticatedIdentity() {
      return {
        id: 'supabase-user-id',
        email: 'admin@example.com',
        emailConfirmedAt: '2026-01-01T00:00:00.000Z',
      };
    },
    async findNeexUserByVerifiedEmail(email) {
      return {
        id: 'neex-user-id',
        companyId: 'company-id',
        name: 'Admin',
        email,
        status: 'ACTIVE',
        permitirAcesso: true,
        company: { id: 'company-id', status: 'ativo' },
        role: {
          id: 'role-id',
          name: 'Administrador',
          status: 'ACTIVE',
          isAdmin: true,
          permissions: [
            { module: 'CLIENTES', action: 'VIEW', allowed: true },
            { module: 'USUARIOS', action: 'DELETE', allowed: false },
          ],
        },
      };
    },
  };
}

async function expectAuthError(
  expectedCode: ServerAuthError['code'],
  dependencies: ServerAuthResolverDependencies
) {
  await assert.rejects(
    () => resolveServerAuthContextForTesting(dependencies),
    (error: unknown) => error instanceof ServerAuthError && error.code === expectedCode
  );
}

test('resolves a trusted context from valid Supabase and Prisma identities', async () => {
  const context = await resolveServerAuthContextForTesting(validDependencies());

  assert.deepEqual(context, {
    authUserId: 'supabase-user-id',
    userId: 'neex-user-id',
    companyId: 'company-id',
    name: 'Admin',
    email: 'admin@example.com',
    roleId: 'role-id',
    roleName: 'Administrador',
    isAdmin: true,
    permissions: { 'CLIENTES:VIEW': true },
  });
});

test('rejects a missing Supabase identity', async () => {
  const dependencies = validDependencies();
  dependencies.getAuthenticatedIdentity = async () => null;

  await expectAuthError('UNAUTHENTICATED', dependencies);
});

test('rejects a Supabase identity without a matching NEEX user', async () => {
  const dependencies = validDependencies();
  dependencies.findNeexUserByVerifiedEmail = async () => null;

  await expectAuthError('NEEX_USER_NOT_FOUND', dependencies);
});

test('rejects an inactive NEEX user', async () => {
  const dependencies = validDependencies();
  const findUser = dependencies.findNeexUserByVerifiedEmail;
  dependencies.findNeexUserByVerifiedEmail = async (email) => ({
    ...(await findUser(email))!,
    status: 'INACTIVE',
  });

  await expectAuthError('USER_INACTIVE', dependencies);
});

test('rejects a NEEX user without access permission', async () => {
  const dependencies = validDependencies();
  const findUser = dependencies.findNeexUserByVerifiedEmail;
  dependencies.findNeexUserByVerifiedEmail = async (email) => ({
    ...(await findUser(email))!,
    permitirAcesso: false,
  });

  await expectAuthError('ACCESS_NOT_ALLOWED', dependencies);
});

test('loads role and only allowed permissions from Prisma data', async () => {
  const context = await resolveServerAuthContextForTesting(validDependencies());

  assert.equal(context.roleId, 'role-id');
  assert.equal(context.roleName, 'Administrador');
  assert.equal(context.isAdmin, true);
  assert.deepEqual(context.permissions, { 'CLIENTES:VIEW': true });
  assert.equal('USUARIOS:DELETE' in context.permissions, false);
});

test('ignores forged legacy-cookie authorization data', async () => {
  const dependenciesWithUntrustedCookie = Object.assign(validDependencies(), {
    legacyCookie: {
      userId: 'attacker-user-id',
      companyId: 'attacker-company-id',
      isAdmin: false,
      permissions: { 'SISTEMA:ADMIN': true },
    },
  });

  const context = await resolveServerAuthContextForTesting(dependenciesWithUntrustedCookie);

  assert.equal(context.userId, 'neex-user-id');
  assert.equal(context.companyId, 'company-id');
  assert.equal(context.isAdmin, true);
  assert.equal('SISTEMA:ADMIN' in context.permissions, false);
});

test('test dependency injection is fail-closed in production', async () => {
  const mutableEnvironment = process.env as Record<string, string | undefined>;
  const originalNodeEnv = mutableEnvironment.NODE_ENV;

  try {
    mutableEnvironment.NODE_ENV = 'production';
    await expectAuthError('INVALID_CONTEXT', validDependencies());
  } finally {
    if (originalNodeEnv === undefined) {
      delete mutableEnvironment.NODE_ENV;
    } else {
      mutableEnvironment.NODE_ENV = originalNodeEnv;
    }
  }
});
