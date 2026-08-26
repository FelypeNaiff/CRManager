import assert from 'node:assert/strict';
import test from 'node:test';
import type { CancelSaleInput, CreateSaleInput } from './sales-schemas';
import { scopeCancelSaleInput, scopeCreateSaleInput, tenantListWhere, tenantResourceWhere } from './sales-tenant-security';

const createInput = {
  companyId: 'forged-company', sellerId: 'seller-a', subtotal: 10,
  discountAmount: 0, totalAmount: 10,
  items: [{ variantId: 'variant-a', quantity: 1, unitPrice: 10, discount: 0,
    totalPrice: 10, productNameSnapshot: 'P', variantNameSnapshot: 'V',
    skuSnapshot: 'S', costPriceAtSale: 5, salePriceAtSale: 10, marginAtSale: 5 }],
  payments: [{ paymentMethodId: 'payment-a', amount: 10, installments: 1 }],
} as CreateSaleInput;

test('create sale ignores forged companyId and uses authenticated tenant', () => {
  const scoped = scopeCreateSaleInput(createInput, { companyId: 'company-a' });
  assert.equal(scoped.companyId, 'company-a');
  assert.equal(scoped.sellerId, 'seller-a');
});

test('cancel sale ignores forged executor and uses authenticated user', () => {
  const input: CancelSaleInput = {
    saleId: 'sale-a', cancelReason: 'Solicitação válida', cancelledByUserId: 'forged-user',
  };
  const scoped = scopeCancelSaleInput(input, { userId: 'auth-user' });
  assert.equal(scoped.cancelledByUserId, 'auth-user');
});

test('tenant resource scope permits own resource and hides another tenant', () => {
  const records = [
    { id: 'sale-a', companyId: 'company-a' },
    { id: 'sale-b', companyId: 'company-b' },
  ];
  const ownWhere = tenantResourceWhere('sale-a', 'company-a');
  const crossWhere = tenantResourceWhere('sale-b', 'company-a');
  const find = (where: typeof ownWhere) => records.find(
    record => record.id === where.id && record.companyId === where.companyId
  );
  assert.deepEqual(find(ownWhere), records[0]);
  assert.equal(find(crossWhere), undefined);
  assert.equal(find(tenantResourceWhere('missing', 'company-a')), undefined);
});

test('admin resource scope remains limited to authenticated tenant', () => {
  assert.deepEqual(tenantResourceWhere('sale-b', 'company-a'), {
    id: 'sale-b', companyId: 'company-a',
  });
});

test('sales, payment methods, sellers and searches use only authenticated tenant', () => {
  const records = [
    { id: 'own', companyId: 'company-a' },
    { id: 'other', companyId: 'company-b' },
  ];
  const where = tenantListWhere('company-a');
  assert.deepEqual(records.filter(record => record.companyId === where.companyId), [records[0]]);
});
