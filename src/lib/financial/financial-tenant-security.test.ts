import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approvedCashAuthorizationWhere,
  cashMovementPermission,
  financialTenantWhere,
  secureFinancialActor,
} from './financial-tenant-security';

const auth = { companyId: 'company-a', userId: 'user-a', isAdmin: false };

test('cash register, bank account and transaction predicates carry auth tenant', () => {
  for (const id of ['cash-a', 'bank-a', 'transaction-a']) {
    assert.deepEqual(financialTenantWhere(id, auth.companyId), { id, companyId: 'company-a' });
  }
});

test('every transaction relationship remains scoped to auth.companyId', () => {
  for (const id of [
    'bank-a', 'cash-a', 'payment-a', 'cost-center-a', 'financial-account-a', 'customer-a',
  ]) {
    assert.equal(financialTenantWhere(id, auth.companyId).companyId, 'company-a');
  }
});

test('an external resource cannot satisfy the authenticated tenant predicate', () => {
  assert.equal(financialTenantWhere('resource-b', auth.companyId).companyId === 'company-b', false);
});

test('forged company and operator are ignored', () => {
  assert.deepEqual(
    secureFinancialActor(auth, { companyId: 'company-b', userId: 'user-b', operatorId: 'operator-b' }),
    { companyId: 'company-a', userId: 'user-a' },
  );
});

test('cash operations use semantic permissions', () => {
  assert.equal(cashMovementPermission('REFORCO'), 'CASH_SUPPLY');
  assert.equal(cashMovementPermission('SANGRIA'), 'CASH_WITHDRAWAL');
  assert.equal(cashMovementPermission('AJUSTE'), 'AUTHORIZE_MOVEMENT');
});

test('cash authorization is bound to tenant, purpose and register', () => {
  assert.deepEqual(
    approvedCashAuthorizationWhere('auth-a', 'company-a', 'cash-a', 'CASH_WITHDRAWAL'),
    {
      id: 'auth-a', companyId: 'company-a', status: 'APPROVED', module: 'CAIXA',
      type: 'CASH_WITHDRAWAL', referenceId: 'cash-a', referenceModule: 'CASH_REGISTER',
    },
  );
});

test('admin remains restricted to its authenticated tenant', () => {
  assert.equal(financialTenantWhere('bank-b', { ...auth, isAdmin: true }.companyId).companyId, 'company-a');
});
