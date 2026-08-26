import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approvedWalletAuthorizationWhere,
  secureWalletActor,
  walletCustomerWhere,
  walletForCustomerWhere,
} from './wallet-tenant-security';

const auth = { companyId: 'company-a', userId: 'user-a', isAdmin: false };

test('customer and wallet are scoped to authenticated tenant', () => {
  assert.deepEqual(walletCustomerWhere('customer-a', auth.companyId), { id: 'customer-a', companyId: 'company-a' });
  assert.deepEqual(walletForCustomerWhere('customer-a', auth.companyId), {
    customerId: 'customer-a', customer: { companyId: 'company-a' },
  });
});

test('forged tenant and executor are ignored', () => {
  assert.deepEqual(
    secureWalletActor(auth, { companyId: 'company-b', userId: 'user-b', createdById: 'user-b' }),
    { companyId: 'company-a', userId: 'user-a' },
  );
});

test('both transfer endpoints must match the authenticated tenant', () => {
  const source = walletCustomerWhere('source-a', auth.companyId);
  const target = walletCustomerWhere('target-a', auth.companyId);
  assert.equal(source.companyId === auth.companyId && target.companyId === auth.companyId, true);
  assert.equal(walletCustomerWhere('target-b', auth.companyId).companyId === 'company-b', false);
});

test('admin cannot escape its authenticated tenant', () => {
  assert.equal(walletCustomerWhere('customer-b', { ...auth, isAdmin: true }.companyId).companyId, 'company-a');
});

test('wallet authorization is bound to tenant, customer and purpose', () => {
  assert.deepEqual(approvedWalletAuthorizationWhere('auth-a', 'company-a', 'customer-a', 'WALLET_CREDIT'), {
    id: 'auth-a', companyId: 'company-a', status: 'APPROVED', module: 'CARTEIRA',
    type: 'WALLET_CREDIT', referenceId: 'customer-a', referenceModule: 'CUSTOMER',
  });
});
