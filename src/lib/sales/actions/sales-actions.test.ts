import test from 'node:test';
import assert from 'node:assert/strict';
import { createCancelSaleAction, createCreateSaleAction, createGetSaleAction, createListSalesAction } from './sales-action-handlers';

const auth = { userId: 'user-a', companyId: 'company-a' };
const validSale: any = {
  companyId: 'forged-company', sellerId: 'seller-a', subtotal: 10, discountAmount: 0, totalAmount: 10,
  items: [{ variantId: 'variant-a', productNameSnapshot: 'A', variantNameSnapshot: 'A1', skuSnapshot: 'A-1', quantity: 1, unitPrice: 10, discount: 0, totalPrice: 10, costPriceAtSale: 5, salePriceAtSale: 10, marginAtSale: 50 }],
  payments: [{ paymentMethodId: 'cash', amount: 10, installments: 1 }],
};

test('create requires RBAC and overwrites a forged company and executor', async () => {
  let received: any;
  const action = createCreateSaleAction({
    authorize: async () => auth,
    service: { createSale: async (data: any, userId: string) => (received = { data, userId }, { id: 'sale-a' }) },
    revalidate: () => {},
  } as any);
  const result = await action(validSale);
  assert.equal(result.success, true);
  assert.equal(received.data.companyId, 'company-a');
  assert.equal(received.userId, 'user-a');
});

test('create denies unauthenticated callers without invoking the service', async () => {
  let invoked = false;
  const action = createCreateSaleAction({ authorize: async () => { throw new Error('unauthenticated'); }, service: { createSale: async () => { invoked = true; } }, revalidate: () => {} } as any);
  assert.deepEqual(await action(validSale), { success: false, error: 'Não foi possível registrar a venda.' });
  assert.equal(invoked, false);
});

test('list ignores external companyId and uses authenticated tenant', async () => {
  let companyId = '';
  const action = createListSalesAction({ authorize: async () => auth, service: { listSales: async (id: string) => (companyId = id, { data: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 }) } } as any);
  const result = await action('company-b', { sellerId: 'seller-a' });
  assert.equal(result.success, true);
  assert.equal(companyId, 'company-a');
});

test('get scopes lookup to authenticated tenant and hides external records', async () => {
  let where: any;
  const found = createGetSaleAction({ authorize: async () => auth, service: { getSaleById: async (...args: any[]) => (where = args, { id: 'sale-a' }) } } as any);
  assert.equal((await found('sale-a')).success, true);
  assert.deepEqual(where, ['sale-a', 'company-a']);
  const hidden = createGetSaleAction({ authorize: async () => auth, service: { getSaleById: async () => null } } as any);
  assert.deepEqual(await hidden('external-sale'), { success: false, error: 'Venda não encontrada.' });
});

test('cancel derives tenant and executor from auth and preserves result contract', async () => {
  let received: any;
  const action = createCancelSaleAction({
    authorize: async () => auth,
    service: { cancelSale: async (data: any, companyId: string) => (received = { data, companyId }, { id: 'sale-a', status: 'CANCELLED' }) },
    revalidateTag: () => {}, revalidatePath: () => {},
  } as any);
  const result = await action({ saleId: 'sale-a', cancelReason: 'Motivo válido', cancelledByUserId: 'forged-user' });
  assert.equal(result.success, true);
  assert.equal(received.companyId, 'company-a');
  assert.equal(received.data.cancelledByUserId, 'user-a');
});

test('list/get/cancel return public errors when authorization fails', async () => {
  const deny = async () => { throw new Error('denied'); };
  assert.equal((await createListSalesAction({ authorize: deny, service: {} } as any)('x')).success, false);
  assert.equal((await createGetSaleAction({ authorize: deny, service: {} } as any)('x')).success, false);
  assert.equal((await createCancelSaleAction({ authorize: deny, service: {}, revalidateTag() {}, revalidatePath() {} } as any)({ saleId: 'x', cancelReason: 'Motivo válido', cancelledByUserId: 'x' })).success, false);
});
