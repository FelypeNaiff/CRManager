import test from 'node:test';
import assert from 'node:assert/strict';
import {
  receivableTenantWhere,
  relatedTenantWhere,
  scopeReceivablesList,
  secureReceivableSettlement,
} from './receivables-tenant-security';

const auth = { companyId: 'company-a', userId: 'user-a', isAdmin: false };

test('forged companyId is ignored and listing uses auth.companyId', () => {
  assert.deepEqual(scopeReceivablesList(auth, { status: 'PENDING', companyId: 'company-b' }, 'company-b'), {
    companyId: 'company-a', status: 'PENDING',
  });
});

test('receivable lookup combines id and authenticated tenant', () => {
  assert.deepEqual(receivableTenantWhere('receivable-a', auth.companyId), {
    id: 'receivable-a', companyId: 'company-a',
  });
});

test('external receivable cannot satisfy the authenticated tenant predicate', () => {
  const where = receivableTenantWhere('receivable-b', auth.companyId);
  assert.equal(where.companyId === 'company-b', false);
});

test('settlement uses authenticated tenant and executor despite forged values', () => {
  assert.deepEqual(
    secureReceivableSettlement(auth, 'receivable-a', { companyId: 'company-b', userId: 'user-b' }),
    { receivableId: 'receivable-a', companyId: 'company-a', userId: 'user-a' },
  );
});

test('related financial resources are tenant scoped', () => {
  assert.deepEqual(relatedTenantWhere('bank-a', auth.companyId), {
    id: 'bank-a', companyId: 'company-a',
  });
});

test('admin remains scoped to its own tenant', () => {
  const admin = { ...auth, isAdmin: true };
  assert.equal(receivableTenantWhere('receivable-b', admin.companyId).companyId, 'company-a');
});
