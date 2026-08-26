import assert from 'node:assert/strict';
import test from 'node:test';
import { fromReportCacheArguments, scopeReportFilters, toReportCacheArguments } from './report-tenant-security';

test('forged report companyId is ignored in favor of authenticated tenant', () => {
  const scoped = scopeReportFilters(
    { companyId: 'forged-company', sellerId: 'seller-a', customerId: 'customer-a' },
    { companyId: 'company-a' }
  );
  assert.equal(scoped.companyId, 'company-a');
  assert.equal(scoped.sellerId, 'seller-a');
  assert.equal(scoped.customerId, 'customer-a');
});

test('cache arguments include tenant and cannot cross companies', () => {
  const companyA = toReportCacheArguments({ companyId: 'company-a', status: 'PAID' });
  const companyB = toReportCacheArguments({ companyId: 'company-b', status: 'PAID' });
  assert.notDeepEqual(companyA, companyB);
  assert.equal(companyA[0], 'company-a');
  assert.equal(fromReportCacheArguments(companyA).companyId, 'company-a');
});

test('relational filters remain subordinate to the authenticated tenant', () => {
  const scoped = scopeReportFilters(
    { companyId: 'company-b', sellerId: 'seller-from-b', customerId: 'customer-from-b' },
    { companyId: 'company-a' }
  );
  assert.deepEqual(scoped, {
    companyId: 'company-a', sellerId: 'seller-from-b', customerId: 'customer-from-b',
  });
  // Service queries always combine these optional IDs with scoped companyId.
});

test('admin report scope remains limited to its authenticated tenant', () => {
  const scoped = scopeReportFilters({ companyId: 'other' }, { companyId: 'admin-company' });
  assert.equal(scoped.companyId, 'admin-company');
});
