import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { routeAuthenticatedLogin } from './login-routing';
import { createProfileSelector, verifyProfileSelector } from './profile-selector';
import {
  resolveSelectedServerAuthContextForTesting,
  type ServerAuthContext,
} from './server-auth-context';

const SECRET = 'test-only-secret-with-at-least-thirty-two-bytes';
const NOW = 2_000_000_000;

function context(overrides: Partial<ServerAuthContext> = {}): ServerAuthContext {
  return {
    authUserId: 'supabase-admin-id', authenticatedUserId: 'admin-user-id',
    userId: 'admin-user-id',
    companyId: 'company-a',
    name: 'Admin',
    email: 'admin@example.test',
    roleId: 'admin-role-id',
    roleName: 'Administrador',
    isAdmin: true,
    permissions: {},
    ...overrides,
  };
}

function issue(profileId: string, authUserId: string) {
  return createProfileSelector({ profileId, authUserId }, SECRET, NOW);
}

test('admin is routed to dashboard with a session for its own user', () => {
  let issuedFor: { profileId: string; authUserId: string } | null = null;
  const result = routeAuthenticatedLogin(context(), (profileId, authUserId) => {
    issuedFor = { profileId, authUserId };
    return issue(profileId, authUserId);
  });

  assert.equal(result.redirectTo, '/dashboard');
  assert.deepEqual(issuedFor, {
    profileId: 'admin-user-id',
    authUserId: 'supabase-admin-id',
  });
  assert.ok(result.profileSession);
});

test('admin session is minimal and does not trust client role or tenant fields', () => {
  const forgedContext = {
    ...context(),
    clientIsAdmin: false,
    clientCompanyId: 'company-b',
  };
  const result = routeAuthenticatedLogin(forgedContext, issue);
  const payload = verifyProfileSelector(
    result.profileSession!,
    SECRET,
    'supabase-admin-id',
    NOW
  );

  assert.equal(payload.profileId, 'admin-user-id');
  assert.equal('companyId' in payload, false);
  assert.equal('isAdmin' in payload, false);
});

test('operational user is routed to profile selection without creating a session', () => {
  let sessionIssued = false;
  const result = routeAuthenticatedLogin(
    context({ isAdmin: false }),
    () => {
      sessionIssued = true;
      throw new Error('operational login must not issue a session before PIN validation');
    }
  );

  assert.equal(result.redirectTo, '/selecionar-perfil');
  assert.equal(result.profileSession, null);
  assert.equal(sessionIssued, false);
});

test('admin session is accepted by server context resolution and remains tenant scoped', async () => {
  const login = routeAuthenticatedLogin(
    context(),
    (profileId, authUserId) => createProfileSelector({ profileId, authUserId }, SECRET)
  );
  let lookup: { profileId: string; companyId: string } | null = null;
  const resolved = await resolveSelectedServerAuthContextForTesting(
    context(),
    login.profileSession!,
    SECRET,
    {
      async findSelectedUser(profileId, companyId) {
        lookup = { profileId, companyId };
        if (profileId !== 'admin-user-id' || companyId !== 'company-a') return null;
        return {
          id: 'admin-user-id',
          companyId: 'company-a',
          name: 'Admin',
          email: 'admin@example.test',
          status: 'ACTIVE',
          permitirAcesso: true,
          company: { id: 'company-a', status: 'ACTIVE' },
          role: {
            id: 'admin-role-id',
            name: 'Administrador',
            status: 'ACTIVE',
            isAdmin: true,
            permissions: [{ module: 'CONFIGURACOES', action: 'VIEW', allowed: true }],
          },
        };
      },
    }
  );

  assert.deepEqual(lookup, { profileId: 'admin-user-id', companyId: 'company-a' });
  assert.equal(resolved.authenticatedUserId, 'admin-user-id');
  assert.equal(resolved.userId, 'admin-user-id');
  assert.equal(resolved.companyId, 'company-a');
  assert.equal(resolved.isAdmin, true);
});

test('login authorization contains no hardcoded email and does not call PIN validation', () => {
  const routeSource = readFileSync('src/app/api/auth/login/route.ts', 'utf8');
  const routingSource = readFileSync('src/lib/auth/login-routing.ts', 'utf8');
  const authorizationSource = `${routeSource}\n${routingSource}`;

  assert.doesNotMatch(authorizationSource, /felypenaiff01@gmail\.com|trupekidsmcp@gmail\.com/);
  assert.doesNotMatch(authorizationSource, /validateProfilePin/);
  assert.match(routeSource, /resolveBaseServerAuthContext\(\)/);
});
