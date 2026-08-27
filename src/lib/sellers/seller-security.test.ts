import assert from 'node:assert/strict';
import test from 'node:test';
import { SELLER_PERMISSIONS, sellerTenantWhere } from './seller-security';

test('seller actions use existing semantic RBAC permissions', () => {
  assert.deepEqual(SELLER_PERMISSIONS.view, { module: 'USUARIOS', action: 'VIEW' });
  assert.deepEqual(SELLER_PERMISSIONS.create, { module: 'USUARIOS', action: 'CREATE' });
  assert.deepEqual(SELLER_PERMISSIONS.update, { module: 'USUARIOS', action: 'UPDATE' });
  assert.deepEqual(SELLER_PERMISSIONS.disable, { module: 'USUARIOS', action: 'DISABLE' });
});

test('seller mutation combines id and authenticated tenant', () => {
  assert.deepEqual(sellerTenantWhere('seller-a', 'tenant-a'), { id: 'seller-a', companyId: 'tenant-a' });
  assert.notDeepEqual(sellerTenantWhere('seller-a', 'tenant-a'), { id: 'seller-a', companyId: 'tenant-b' });
});

test('admin remains tenant scoped by the same predicate', () => {
  assert.equal(sellerTenantWhere('seller-b', 'tenant-a').companyId, 'tenant-a');
});
