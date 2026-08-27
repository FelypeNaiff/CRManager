import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthorizationType } from '@prisma/client';
import { approvedAuthorizationWhere, authorizationBelongsToTenant, canonicalAuthorizationModule } from './authorization-security';

test('authorization lookup is tenant scoped', () => {
  assert.deepEqual(authorizationBelongsToTenant('auth-1', 'company-1'), { id: 'auth-1', companyId: 'company-1' });
});

test('approved authorization binds status, purpose and resource', () => {
  assert.deepEqual(approvedAuthorizationWhere({ id: 'auth-1', companyId: 'company-1', type: AuthorizationType.WALLET_CREDIT, module: 'CARTEIRA', referenceId: 'customer-1', referenceModule: 'CUSTOMER' }), {
    id: 'auth-1', companyId: 'company-1', status: 'APPROVED', type: 'WALLET_CREDIT', module: 'CARTEIRA', referenceId: 'customer-1', referenceModule: 'CUSTOMER',
  });
});

test('different tenant, type, module and references cannot share a predicate', () => {
  const base = approvedAuthorizationWhere({ id: 'a', companyId: 'c1', type: AuthorizationType.CASH_SUPPLY, module: 'CAIXA', referenceId: 'cash-1', referenceModule: 'CASH_REGISTER' });
  assert.notDeepEqual(base, approvedAuthorizationWhere({ id: 'a', companyId: 'c2', type: AuthorizationType.CASH_SUPPLY, module: 'CAIXA', referenceId: 'cash-1', referenceModule: 'CASH_REGISTER' }));
  assert.notDeepEqual(base, approvedAuthorizationWhere({ id: 'a', companyId: 'c1', type: AuthorizationType.WALLET_CREDIT, module: 'CARTEIRA', referenceId: 'customer-1', referenceModule: 'CUSTOMER' }));
  assert.notDeepEqual(base, approvedAuthorizationWhere({ id: 'a', companyId: 'c1', type: AuthorizationType.CASH_SUPPLY, module: 'CAIXA', referenceId: 'cash-2', referenceModule: 'CASH_REGISTER' }));
});

test('canonical module is server-derived from authorization type', () => {
  assert.equal(canonicalAuthorizationModule(AuthorizationType.RETURN), 'DEVOLUCOES');
  assert.equal(canonicalAuthorizationModule(AuthorizationType.STOCK_ADJUST), 'ESTOQUE');
});
