import assert from 'node:assert/strict';
import test from 'node:test';
import { assertTenantMigrationLinks, tenantMigrationWhere } from './wallet-migration-security';

test('admin tenant A counts and migrates only tenant A predicates', () => {
  const where = tenantMigrationWhere('tenant-a');
  assert.deepEqual(where.legacyReturns, { companyId: 'tenant-a' });
  assert.deepEqual(where.wallets, { customer: { companyId: 'tenant-a' } });
  assert.deepEqual(where.walletRecords, { wallet: { customer: { companyId: 'tenant-a' } } });
});

test('recalculation remains restricted through wallet customer tenant', () => {
  assert.equal(tenantMigrationWhere('tenant-a').wallets.customer.companyId, 'tenant-a');
  assert.notEqual(tenantMigrationWhere('tenant-a').wallets.customer.companyId, 'tenant-b');
});

test('migration actor has no global fallback', () => {
  assert.deepEqual(tenantMigrationWhere('tenant-a').actor('admin-a'), { id: 'admin-a', companyId: 'tenant-a', status: 'ACTIVE' });
});

test('unprovable legacy relation fails closed', () => {
  assert.throws(() => assertTenantMigrationLinks({ legacySaleIds: ['sale-b'], tenantSaleIds: [], legacyCustomerIds: [], tenantCustomerIds: [] }));
});

test('tenant-linked legacy relations pass', () => {
  assert.doesNotThrow(() => assertTenantMigrationLinks({ legacySaleIds: ['sale-a'], tenantSaleIds: ['sale-a'], legacyCustomerIds: ['customer-a'], tenantCustomerIds: ['customer-a'] }));
});
