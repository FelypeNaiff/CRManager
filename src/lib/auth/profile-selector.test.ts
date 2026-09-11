import assert from 'node:assert/strict';
import test from 'node:test';
import { ServerAuthError, type ServerAuthContext } from './server-auth-context';
import { createProfileSelectionServiceForTesting } from './actions';
import {
  createProfileSelector,
  getProfileSessionSecret,
  verifyProfileSelector,
} from './profile-selector';

const SECRET = 'test-only-secret-with-at-least-thirty-two-bytes';
const NOW = 2_000_000_000;

function context(overrides: Partial<ServerAuthContext> = {}): ServerAuthContext {
  return {
    authUserId: 'auth-user-a', userId: 'base-user', companyId: 'company-a',
    name: 'Base', email: 'base@example.test', roleId: 'role-a', roleName: 'Base',
    isAdmin: false, permissions: {}, ...overrides,
  };
}

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-a', companyId: 'company-a', name: 'Operator',
    email: 'operator@example.test', cargo: 'Operator', roleId: 'role-a',
    status: 'ACTIVE', permitirAcesso: true, pinAccessHash: 'bcrypt-hash',
    role: { status: 'ACTIVE', isAdmin: false },
    ...overrides,
  };
}

async function service(options: {
  base?: () => Promise<ServerAuthContext>;
  profiles?: ReturnType<typeof profile>[];
  selected?: ReturnType<typeof profile> | null;
  pinValid?: boolean;
} = {}) {
  return createProfileSelectionServiceForTesting({
    resolveBaseContext: options.base ?? (async () => context()),
    listProfiles: async () => options.profiles ?? [profile()],
    findProfile: async (profileId) => {
      const selected = options.selected === undefined ? profile() : options.selected;
      return selected?.id === profileId ? selected : null;
    },
    verifyPinValue: async () => options.pinValid ?? true,
    issueSelector: (profileId, authUserId) =>
      createProfileSelector({ profileId, authUserId }, SECRET, NOW),
  });
}

test('without Supabase identity profile listing is denied', async () => {
  const result = await (await service({
    base: async () => { throw new ServerAuthError('UNAUTHENTICATED'); },
  })).getAvailableProfiles();
  assert.equal(result.success, false);
  assert.deepEqual(result.profiles, []);
});

test('valid identity lists only eligible profiles from its company', async () => {
  const result = await (await service({ profiles: [profile(), profile({ id: 'other', companyId: 'company-b' })] }))
    .getAvailableProfiles();
  assert.equal(result.success, true);
  assert.deepEqual(result.profiles.map((item) => item.id), ['profile-a']);
  assert.equal('pinAccessHash' in result.profiles[0], false);
  assert.equal('companyId' in result.profiles[0], false);
});

test('admin User does not appear in operational profile selection', async () => {
  const result = await (await service({
    profiles: [profile(), profile({ id: 'admin', role: { status: 'ACTIVE', isAdmin: true } })],
  })).getAvailableProfiles();
  assert.deepEqual(result.profiles.map((item) => item.id), ['profile-a']);
});

test('base identity User does not appear in operational profile selection', async () => {
  const result = await (await service({
    profiles: [profile(), profile({ id: 'base-user' })],
  })).getAvailableProfiles();
  assert.deepEqual(result.profiles.map((item) => item.id), ['profile-a']);
});

test('inactive User does not appear in operational profile selection', async () => {
  const result = await (await service({
    profiles: [profile(), profile({ id: 'inactive', status: 'INACTIVE' })],
  })).getAvailableProfiles();
  assert.deepEqual(result.profiles.map((item) => item.id), ['profile-a']);
});

test('User without access does not appear in operational profile selection', async () => {
  const result = await (await service({
    profiles: [profile(), profile({ id: 'blocked', permitirAcesso: false })],
  })).getAvailableProfiles();
  assert.deepEqual(result.profiles.map((item) => item.id), ['profile-a']);
});

test('User with inactive Role does not appear in operational profile selection', async () => {
  const result = await (await service({
    profiles: [profile(), profile({ id: 'inactive-role', role: { status: 'INACTIVE', isAdmin: false } })],
  })).getAvailableProfiles();
  assert.deepEqual(result.profiles.map((item) => item.id), ['profile-a']);
});

test('profile from another tenant is refused even when PIN matches', async () => {
  const result = await (await service({ selected: profile({ companyId: 'company-b' }) }))
    .validateProfilePin('profile-a', '1234');
  assert.equal(result.success, false);
});

test('inactive profile is refused', async () => {
  const result = await (await service({ selected: profile({ status: 'INACTIVE' }) }))
    .validateProfilePin('profile-a', '1234');
  assert.equal(result.success, false);
});

test('direct PIN validation of admin profile is refused', async () => {
  const result = await (await service({
    selected: profile({ role: { status: 'ACTIVE', isAdmin: true } }),
  })).validateProfilePin('profile-a', '1234');
  assert.equal(result.success, false);
});

test('direct PIN validation of base identity User is refused', async () => {
  const result = await (await service({
    selected: profile({ id: 'base-user' }),
  })).validateProfilePin('base-user', '1234');
  assert.equal(result.success, false);
});

test('incorrect PIN is refused', async () => {
  const result = await (await service({ pinValid: false })).validateProfilePin('profile-a', '9999');
  assert.equal(result.success, false);
});

test('correct PIN emits a minimal selector', async () => {
  const result = await (await service()).validateProfilePin('profile-a', '1234');
  assert.equal(result.success, true);
  if (!result.success) return;
  const payload = verifyProfileSelector(result.selector, SECRET, 'auth-user-a', NOW);
  assert.equal(payload.profileId, 'profile-a');
  assert.equal('isAdmin' in payload, false);
  assert.equal('permissions' in payload, false);
  assert.equal('role' in payload, false);
  assert.equal('companyId' in payload, false);
});

test('tampered cookie is refused', () => {
  const token = createProfileSelector({ profileId: 'profile-a', authUserId: 'auth-user-a' }, SECRET, NOW);
  assert.throws(() => verifyProfileSelector(`${token}x`, SECRET, 'auth-user-a', NOW));
});

test('invalid signature is refused', () => {
  const token = createProfileSelector({ profileId: 'profile-a', authUserId: 'auth-user-a' }, SECRET, NOW);
  assert.throws(() => verifyProfileSelector(token, `${SECRET}-wrong`, 'auth-user-a', NOW));
});

test('expired selector is refused', () => {
  const token = createProfileSelector({ profileId: 'profile-a', authUserId: 'auth-user-a' }, SECRET, NOW);
  assert.throws(() => verifyProfileSelector(token, SECRET, 'auth-user-a', NOW + 3600));
});

test('selector bound to another Supabase identity is refused', () => {
  const token = createProfileSelector({ profileId: 'profile-a', authUserId: 'auth-user-a' }, SECRET, NOW);
  assert.throws(() => verifyProfileSelector(token, SECRET, 'auth-user-b', NOW));
});

test('missing production secret fails closed', () => {
  const original = process.env.NEEX_PROFILE_SESSION_SECRET;
  delete process.env.NEEX_PROFILE_SESSION_SECRET;
  try {
    assert.throws(() => getProfileSessionSecret());
  } finally {
    if (original === undefined) delete process.env.NEEX_PROFILE_SESSION_SECRET;
    else process.env.NEEX_PROFILE_SESSION_SECRET = original;
  }
});
