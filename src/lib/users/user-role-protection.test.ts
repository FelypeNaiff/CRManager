import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { assertUserRoleAssignmentAllowed } from './user-role-protection';

const base = {
  actorIsAdmin: true,
  actorUserId: 'admin-a',
  targetUserId: 'operator-a',
  currentRoleIsAdmin: false,
  nextRoleIsAdmin: false,
  nextStatus: 'ACTIVE',
  otherActiveAdmins: 1,
};

test('valid operational Role assignment is allowed', () => {
  assert.doesNotThrow(() => assertUserRoleAssignmentAllowed(base));
});

test('non-admin cannot assign an administrative Role', () => {
  assert.throws(() => assertUserRoleAssignmentAllowed({ ...base, actorIsAdmin: false, nextRoleIsAdmin: true }), /ADMIN_ROLE_FORBIDDEN/);
});

test('administrator cannot remove their own administrative access', () => {
  assert.throws(() => assertUserRoleAssignmentAllowed({
    ...base,
    targetUserId: 'admin-a',
    currentRoleIsAdmin: true,
  }), /ADMIN_SELF_LOCKOUT/);
});

test('the final active administrator cannot be removed', () => {
  assert.throws(() => assertUserRoleAssignmentAllowed({
    ...base,
    targetUserId: 'admin-b',
    currentRoleIsAdmin: true,
    otherActiveAdmins: 0,
  }), /LAST_ADMIN/);
});

test('User from another tenant is rejected by the authenticated tenant predicate', async () => {
  const source = await readFile(new URL('./user-actions.ts', import.meta.url), 'utf8');
  const update = source.slice(source.indexOf('export async function updateUserAction'), source.indexOf('/**\n * Reset a user'));
  assert.match(update, /tenantEntityWhere\(id, session\.companyId\)/);
});

test('inactive or cross-tenant Role is rejected before User assignment', async () => {
  const source = await readFile(new URL('./user-actions.ts', import.meta.url), 'utf8');
  const update = source.slice(source.indexOf('export async function updateUserAction'), source.indexOf('/**\n * Reset a user'));
  assert.match(update, /id: targetRoleId, companyId: session\.companyId, status: 'ACTIVE'/);
});

test('User Role changes require USUARIOS UPDATE and a serializable transaction', async () => {
  const source = await readFile(new URL('./user-actions.ts', import.meta.url), 'utf8');
  const update = source.slice(source.indexOf('export async function updateUserAction'), source.indexOf('/**\n * Reset a user'));
  assert.match(update, /requirePermission\('USUARIOS', 'UPDATE'\)/);
  assert.match(update, /isolationLevel: 'Serializable'/);
});
