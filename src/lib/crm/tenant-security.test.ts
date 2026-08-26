import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticatedActor,
  tenantChildWhere,
  tenantTagRelationWhere,
  tenantWhere,
} from './tenant-security';

test('forged company and executor never override authenticated context', () => {
  assert.deepEqual(
    authenticatedActor(
      { companyId: 'company-a', userId: 'user-a' },
      { companyId: 'company-b', userId: 'user-b' },
    ),
    { companyId: 'company-a', userId: 'user-a' },
  );
});

test('customer and product predicates always carry the authenticated tenant', () => {
  assert.deepEqual(tenantWhere('resource-a', 'company-a'), {
    id: 'resource-a', companyId: 'company-a',
  });
});

test('dependent predicate scopes through its owning customer', () => {
  assert.deepEqual(tenantChildWhere('child-a', 'company-a'), {
    id: 'child-a', customer: { companyId: 'company-a' },
  });
});

test('tag relationship requires customer and tag from the same tenant', () => {
  assert.deepEqual(tenantTagRelationWhere('customer-a', 'tag-a', 'company-a'), {
    customerId: 'customer-a', tagId: 'tag-a',
    customer: { companyId: 'company-a' }, tag: { companyId: 'company-a' },
  });
});
