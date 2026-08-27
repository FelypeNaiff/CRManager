import assert from 'node:assert/strict';
import test from 'node:test';
import { canSetAdministrativeRole, tenantEntityWhere, tenantRolePermissionWhere, trustedAdministrativeActor } from './admin-tenant-security';

const auth = { companyId: 'company-a', userId: 'user-a', isAdmin: false };

test('user, role and configuration IDs remain tenant scoped', () => {
  assert.deepEqual(tenantEntityWhere('resource-a', auth.companyId), { id: 'resource-a', companyId: 'company-a' });
  assert.notDeepEqual(tenantEntityWhere('resource-a', auth.companyId), { id: 'resource-a', companyId: 'company-b' });
});

test('an external user or role ID does not match the authenticated tenant filter', () => {
  const own = { id: 'user-a', companyId: 'company-a' };
  const external = { id: 'user-a', companyId: 'company-b' };
  const where = tenantEntityWhere('user-a', auth.companyId);
  assert.equal(own.id === where.id && own.companyId === where.companyId, true);
  assert.equal(external.id === where.id && external.companyId === where.companyId, false);
});

test('permission mutation is constrained through its tenant role', () => {
  assert.deepEqual(tenantRolePermissionWhere('role-a', auth.companyId), { roleId: 'role-a', role: { companyId: 'company-a' } });
});

test('a permission delete predicate cannot select a role from another tenant', () => {
  const where = tenantRolePermissionWhere('role-a', auth.companyId);
  assert.equal(where.role.companyId, 'company-a');
  assert.notEqual(where.role.companyId, 'company-b');
});

test('forged company, executor and admin flags are ignored', () => {
  assert.deepEqual(trustedAdministrativeActor(auth, { companyId: 'company-b', userId: 'user-b', isAdmin: true }), auth);
});

test('only a real server-derived admin can grant or remove admin role status', () => {
  assert.equal(canSetAdministrativeRole(auth, false, true), false);
  assert.equal(canSetAdministrativeRole({ ...auth, isAdmin: true }, false, true), true);
  assert.equal(canSetAdministrativeRole(auth, false, false), true);
  assert.equal(canSetAdministrativeRole(auth, true, true), false);
});

test('an admin remains scoped to its own tenant', () => {
  const admin = trustedAdministrativeActor({ ...auth, isAdmin: true }, { companyId: 'company-b' });
  assert.equal(admin.companyId, 'company-a');
});

test('company reads ignore an external company identifier', () => {
  const actor = trustedAdministrativeActor(auth, { companyId: 'company-b' });
  assert.deepEqual(tenantEntityWhere(actor.companyId, actor.companyId), { id: 'company-a', companyId: 'company-a' });
});
