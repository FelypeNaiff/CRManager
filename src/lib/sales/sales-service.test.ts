import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { SalesService } from './sales-service';

const decimal = (value: number) => new Prisma.Decimal(value);
const authContext: any = {
  authUserId: 'auth-base', authenticatedUserId: 'base-user', userId: 'operator-a',
  companyId: 'company-a', name: 'Operador', email: 'operator@example.invalid',
  roleId: 'role-a', roleName: 'Operador', isAdmin: false, permissions: {},
};

function saleInput(overrides: Record<string, any> = {}) {
  return {
    companyId: 'company-a', sellerId: 'seller-a', subtotal: 50, discountAmount: 0, totalAmount: 50,
    items: [
      { variantId: 'variant-a', productNameSnapshot: 'A', variantNameSnapshot: 'A1', skuSnapshot: 'A-1', quantity: 2, unitPrice: 10, discount: 0, totalPrice: 20, costPriceAtSale: 5, salePriceAtSale: 10, marginAtSale: 50 },
      { variantId: 'variant-b', productNameSnapshot: 'B', variantNameSnapshot: 'B1', skuSnapshot: 'B-1', quantity: 1, unitPrice: 30, discount: 0, totalPrice: 30, costPriceAtSale: 15, salePriceAtSale: 30, marginAtSale: 50 },
    ],
    payments: [
      { paymentMethodId: 'cash', amount: 10, installments: 1 },
      { paymentMethodId: 'pix', amount: 10, installments: 1 },
      { paymentMethodId: 'debit', amount: 10, installments: 1 },
      { paymentMethodId: 'credit', amount: 10, installments: 2 },
      { paymentMethodId: 'store-credit', amount: 10, installments: 1 },
    ],
    ...overrides,
  } as any;
}

function harness(options: {
  sellerCompany?: string; stocks?: Record<string, number>; saleStatus?: string;
  discountPolicy?: any; approvedAuthorization?: any; invalidPaymentMethod?: string;
  failReceivables?: boolean;
} = {}) {
  const state = {
    stocks: { 'variant-a': 10, 'variant-b': 10, ...options.stocks },
    sales: [] as any[], movements: [] as any[], logs: [] as any[], calls: [] as any[],
    authorizations: [] as any[],
  };
  const depsCalls = { generate: [] as any[], cancel: [] as any[], process: [] as any[], rollback: [] as any[], authorization: [] as any[], policies: [] as any[] };

  const makeTx = () => ({
    company: { findUnique: async ({ where }: any) => where.id === 'company-a' ? { id: 'company-a' } : null },
    seller: { findFirst: async ({ where }: any) => where.id === 'seller-a' && where.companyId === (options.sellerCompany ?? 'company-a') ? { id: 'seller-a', companyId: options.sellerCompany ?? 'company-a', status: 'ACTIVE' } : null },
    customer: { findFirst: async () => ({ id: 'customer-a' }) },
    paymentMethod: { count: async ({ where }: any) => where.id.in.filter((id: string) => id !== options.invalidPaymentMethod).length },
    cashRegister: { findFirst: async () => null },
    actionAuthorization: {
      findFirst: async ({ where }: any) => {
        const authorization = options.approvedAuthorization;
        return authorization && Object.entries(where).every(([key, value]) => authorization[key] === value) ? authorization : null;
      },
    },
    saleAuthorization: { create: async ({ data }: any) => { state.authorizations.push(data); return data; } },
    productVariant: {
      findMany: async ({ where }: any) => where.id.in.map((id: string) => {
        const canonical = id === 'variant-a'
          ? { salePrice: 10, costPrice: 5, productName: 'Produto A', sku: 'A-1' }
          : { salePrice: 30, costPrice: 15, productName: 'Produto B', sku: 'B-1' };
        return {
          id, name: `${id}-canonical`, sku: canonical.sku, barcode: `${id}-barcode`,
          salePrice: decimal(canonical.salePrice), costPrice: decimal(canonical.costPrice),
          availableStock: decimal(state.stocks[id as keyof typeof state.stocks] ?? 0),
          product: { name: canonical.productName },
        };
      }),
      update: async ({ where, data }: any) => {
        const delta = data.availableStock.decrement ?? -data.availableStock.increment;
        state.stocks[where.id as keyof typeof state.stocks] -= delta;
        state.calls.push({ operation: 'stock.update', where, data });
      },
    },
    sale: {
      create: async ({ data }: any) => {
        const created = { id: 'sale-a', createdAt: new Date(), ...data, items: data.items.create, payments: data.payments.create };
        state.sales.push(created); state.calls.push({ operation: 'sale.create', data }); return created;
      },
      findFirst: async ({ where }: any) => {
        if (where.id !== 'sale-a' || where.companyId !== 'company-a') return null;
        return { id: 'sale-a', companyId: 'company-a', sellerId: 'seller-a', cashRegisterId: null, totalAmount: 50, status: options.saleStatus ?? 'PAID', createdAt: new Date(), items: saleInput().items };
      },
      update: async ({ data }: any) => ({ id: 'sale-a', ...data }),
    },
    inventoryMovement: { createMany: async ({ data }: any) => { state.movements.push(...data); } },
    activityLog: { create: async ({ data }: any) => { state.logs.push(data); return data; } },
    customerHistory: { create: async ({ data }: any) => data },
    $queryRawUnsafe: async () => [],
  });

  const db: any = {
    $transaction: async (callback: any) => {
      const snapshot = structuredClone(state);
      try { return await callback(makeTx()); }
      catch (error) { Object.assign(state, snapshot); throw error; }
    },
    sale: {
      findFirst: async ({ where }: any) => where.id === 'sale-a' && where.companyId === 'company-a' ? { id: 'sale-a' } : null,
      count: async ({ where }: any) => (where.companyId === 'company-a' ? 1 : 0),
      findMany: async ({ where }: any) => (where.companyId === 'company-a' ? [{ id: 'sale-a' }] : []),
    },
  };
  const dependencies: any = {
    operationalSettings: {
      getOrCreateOperationalSettings: async () => ({ requireOpenCashRegister: false, allowSaleWithoutCustomer: true, requireCustomerOnSale: false, allowNegativeStock: false, allowSaleCancellation: true, cancellationTimeLimit: 60, requireAuthorizationToCancelSale: false }),
      validateDiscountPolicy: async (params: any) => {
        depsCalls.policies.push(params);
        return options.discountPolicy ?? { allowed: true, requiresAuthorization: false, limitApplied: 10 };
      },
    },
    authorization: { createAuthorizationRequest: async (data: any) => { depsCalls.authorization.push(data); return { id: 'auth-a' }; } },
    receivables: {
      generateReceivablesFromSale: async (...args: any[]) => {
        depsCalls.generate.push(args);
        if (options.failReceivables) throw new Error('late financial failure');
      },
      cancelReceivablesFromSale: async (...args: any[]) => { depsCalls.cancel.push(args); },
    },
    sellerCommission: {
      processSaleCommission: async (...args: any[]) => { depsCalls.process.push(args); },
      rollbackSaleCommission: async (...args: any[]) => { depsCalls.rollback.push(args); },
    },
  };
  return { service: new SalesService(db, dependencies), state, depsCalls };
}

test('creates a tenant-scoped sale with multiple items and payment types', async () => {
  const { service, state, depsCalls } = harness();
  const sale: any = await service.createSale(saleInput(), 'operator-a', authContext);
  assert.equal(sale.companyId, 'company-a');
  assert.equal(sale.sellerId, 'seller-a');
  assert.equal(sale.items.length, 2);
  assert.equal(sale.subtotal.toNumber(), 50);
  assert.equal(sale.totalAmount.toNumber(), 50);
  assert.deepEqual(sale.payments.map((p: any) => p.paymentMethodId), ['cash', 'pix', 'debit', 'credit', 'store-credit']);
  assert.equal(state.stocks['variant-a'], 8);
  assert.equal(state.stocks['variant-b'], 9);
  assert.equal(state.movements.length, 2);
  assert.equal(state.logs[0].action, 'SALE_CREATE');
  assert.equal(state.logs[0].actorUserId, 'operator-a');
  assert.equal(state.logs[0].authenticatedUserId, 'base-user');
  assert.equal(depsCalls.generate[0][0], 'sale-a');
  assert.equal(depsCalls.process[0][1].sellerId, 'seller-a');
  assert.equal(depsCalls.process[0][1].companyId, 'company-a');
});

test('insufficient stock aborts without partial stock, sale or financial effects', async () => {
  const { service, state, depsCalls } = harness({ stocks: { 'variant-b': 0 } });
  await assert.rejects(service.createSale(saleInput(), 'operator-a'), /Estoque insuficiente/);
  assert.deepEqual(state.stocks, { 'variant-a': 10, 'variant-b': 0 });
  assert.equal(state.sales.length, 0);
  assert.equal(state.movements.length, 0);
  assert.equal(depsCalls.generate.length, 0);
});

test('Seller from another tenant cannot be used', async () => {
  const { service } = harness({ sellerCompany: 'company-b' });
  await assert.rejects(service.createSale(saleInput(), 'operator-a'), /Vendedor inválido/);
});

test('cancels once, restores stock and delegates financial and commission rollback', async () => {
  const { service, state, depsCalls } = harness();
  const result: any = await service.cancelSale({ saleId: 'sale-a', cancelReason: 'Cliente desistiu', cancelledByUserId: 'operator-a' }, 'company-a', authContext);
  assert.equal(result.status, 'CANCELLED');
  assert.equal(state.stocks['variant-a'], 12);
  assert.equal(state.stocks['variant-b'], 11);
  assert.equal(state.movements.every(item => item.type === 'CANCELLATION'), true);
  assert.equal(state.logs[0].action, 'SALE_CANCEL');
  assert.equal(depsCalls.cancel[0][0], 'sale-a');
  assert.equal(depsCalls.rollback[0][1].sellerId, 'seller-a');
});

test('does not allow cancelling an already cancelled sale', async () => {
  const { service } = harness({ saleStatus: 'CANCELLED' });
  await assert.rejects(service.cancelSale({ saleId: 'sale-a', cancelReason: 'Repetido', cancelledByUserId: 'operator-a' }, 'company-a'), /já está cancelada/);
});

test('get and list always include the trusted tenant predicate', async () => {
  const { service } = harness();
  assert.deepEqual(await service.getSaleById('sale-a', 'company-a'), { id: 'sale-a' });
  assert.equal(await service.getSaleById('sale-a', 'company-b'), null);
  const result = await service.listSales('company-a', { sellerId: 'seller-a' });
  assert.equal(result.metadata.totalCount, 1);
  assert.equal((result.data[0] as any).id, 'sale-a');
});

test('discount within or exactly at the policy limit continues without authorization', async () => {
  for (const discountAmount of [5, 10]) {
    const { service, state, depsCalls } = harness({ discountPolicy: { allowed: true, requiresAuthorization: false, limitApplied: 10 } });
    const result: any = await service.createSale(saleInput({
      subtotal: 100, discountAmount, totalAmount: 50 - discountAmount,
      globalDiscountType: 'AMOUNT', globalDiscountValue: discountAmount,
      payments: [{ paymentMethodId: 'cash', amount: 50 - discountAmount, installments: 1 }],
    }), 'operator-a', authContext);
    assert.equal(result.id, 'sale-a');
    assert.equal(state.sales.length, 1);
    assert.equal(depsCalls.authorization.length, 0);
    assert.equal(depsCalls.policies[0].companyId, 'company-a');
    assert.equal(depsCalls.policies[0].userId, 'operator-a');
  }
});

test('discount above limit creates a modern pending authorization and stops the sale', async () => {
  const { service, state, depsCalls } = harness({ discountPolicy: { allowed: false, requiresAuthorization: true, limitApplied: 10 } });
  const result: any = await service.createSale(saleInput({
    subtotal: 100, discountAmount: 15, totalAmount: 35,
    globalDiscountType: 'AMOUNT', globalDiscountValue: 15,
    payments: [{ paymentMethodId: 'cash', amount: 35, installments: 1 }],
  }), 'operator-a');
  assert.deepEqual(result, { requireAuthorization: true, authorizationId: 'auth-a' });
  assert.equal(state.sales.length, 0);
  assert.deepEqual(depsCalls.authorization[0], {
    companyId: 'company-a', type: 'DISCOUNT', module: 'PDV', requestedByUserId: 'operator-a',
    percentage: 30, amount: 15, reason: 'Desconto excede o limite', metadata: { requesterLimit: 10 }, financialImpact: true,
  });
});

test('approved discount authorization must match tenant, status, type and module', async () => {
  const policy = { allowed: false, requiresAuthorization: true, limitApplied: 10 };
  const valid = { id: 'auth-approved', companyId: 'company-a', status: 'APPROVED', type: 'DISCOUNT', module: 'PDV', authorizedByUserId: 'manager-a' };
  const accepted = harness({ discountPolicy: policy, approvedAuthorization: valid });
  const authorizedInput = saleInput({
    subtotal: 100, discountAmount: 15, totalAmount: 35,
    globalDiscountType: 'AMOUNT', globalDiscountValue: 15,
    payments: [{ paymentMethodId: 'cash', amount: 35, installments: 1 }],
    authorizationId: 'auth-approved',
  });
  const sale: any = await accepted.service.createSale(authorizedInput, 'operator-a', authContext);
  assert.equal(sale.id, 'sale-a');
  assert.equal(accepted.state.authorizations[0].requestedByUserId, 'operator-a');
  assert.notEqual(accepted.state.authorizations[0].requestedByUserId, 'seller-a');
  assert.equal(accepted.state.logs.some(log => log.action === 'SALE_CREATE' && log.actorUserId === 'operator-a'), true);

  for (const incompatible of [
    { ...valid, companyId: 'company-b' },
    { ...valid, status: 'PENDING' },
    { ...valid, type: 'SALE_CANCEL' },
    { ...valid, module: 'CAIXA' },
  ]) {
    const denied = harness({ discountPolicy: policy, approvedAuthorization: incompatible });
    await assert.rejects(denied.service.createSale(authorizedInput, 'operator-a'), /Autorização de desconto inválida/);
    assert.equal(denied.state.sales.length, 0);
  }
});

test('missing or arbitrary discount authorization is refused', async () => {
  const { service, state } = harness({ discountPolicy: { allowed: false, requiresAuthorization: true, limitApplied: 10 } });
  await assert.rejects(service.createSale(saleInput({
    globalDiscountType: 'AMOUNT', globalDiscountValue: 15,
    payments: [{ paymentMethodId: 'cash', amount: 35, installments: 1 }],
    authorizationId: 'arbitrary',
  }), 'operator-a'), /Autorização de desconto inválida/);
  assert.equal(state.sales.length, 0);
});

test('server persists canonical prices, snapshots, subtotal and total instead of client monetary fields', async () => {
  for (const forgedTotal of [1, 999]) {
    const { service } = harness();
    const input = saleInput({ subtotal: 1, totalAmount: forgedTotal });
    input.items[0] = { ...input.items[0], unitPrice: 1, costPriceAtSale: 0, salePriceAtSale: 1, totalPrice: 2, productNameSnapshot: 'forged' };
    const sale: any = await service.createSale(input, 'operator-a', authContext);
    assert.equal(sale.items[0].unitPrice.toNumber(), 10);
    assert.equal(sale.items[0].costPriceAtSale.toNumber(), 5);
    assert.equal(sale.items[0].productNameSnapshot, 'Produto A');
    assert.equal(sale.subtotal.toNumber(), 50);
    assert.equal(sale.totalAmount.toNumber(), 50);
  }
});

test('server recalculates valid item and global discounts over canonical prices', async () => {
  const { service } = harness();
  const input = saleInput({
    subtotal: 999, discountAmount: 999, totalAmount: 1,
    globalDiscountType: 'PERCENTAGE', globalDiscountValue: 10,
    payments: [{ paymentMethodId: 'cash', amount: 43.2, installments: 1 }],
  });
  input.items[0] = { ...input.items[0], discountType: 'PERCENTAGE', discountValue: 10, discount: 999, totalPrice: 0 };
  const sale: any = await service.createSale(input, 'operator-a', authContext);
  assert.equal(sale.items[0].discount.toNumber(), 1);
  assert.equal(sale.items[0].totalPrice.toNumber(), 18);
  assert.equal(sale.discountAmount.toNumber(), 6.8);
  assert.equal(sale.totalAmount.toNumber(), 43.2);
});

test('invalid item or global discount intent is rejected before sale effects', async () => {
  for (const input of [
    saleInput({ items: [{ ...saleInput().items[0], discountType: 'PERCENTAGE', discountValue: 101 }] }),
    saleInput({ globalDiscountType: 'AMOUNT', globalDiscountValue: 51 }),
  ]) {
    const { service, state, depsCalls } = harness();
    await assert.rejects(service.createSale(input, 'operator-a', authContext), /desconto/i);
    assert.equal(state.sales.length, 0);
    assert.equal(depsCalls.generate.length, 0);
  }
});

test('payment total below or above canonical sale total is rejected', async () => {
  for (const amount of [49.99, 50.01]) {
    const { service, state } = harness();
    await assert.rejects(service.createSale(saleInput({ payments: [{ paymentMethodId: 'cash', amount, installments: 1 }] }), 'operator-a', authContext), /soma dos pagamentos/i);
    assert.equal(state.sales.length, 0);
  }
});

test('payment method from another tenant is rejected', async () => {
  const { service, state } = harness({ invalidPaymentMethod: 'external-payment' });
  await assert.rejects(service.createSale(saleInput({ payments: [{ paymentMethodId: 'external-payment', amount: 50, installments: 1 }] }), 'operator-a', authContext), /Forma de pagamento inválida/);
  assert.equal(state.sales.length, 0);
});

test('late financial failure rolls back sale, stock, movements, commission and success audit', async () => {
  const { service, state, depsCalls } = harness({ failReceivables: true });
  await assert.rejects(service.createSale(saleInput(), 'operator-a', authContext), /late financial failure/);
  assert.equal(state.sales.length, 0);
  assert.deepEqual(state.stocks, { 'variant-a': 10, 'variant-b': 10 });
  assert.equal(state.movements.length, 0);
  assert.equal(state.logs.length, 0);
  assert.equal(depsCalls.process.length, 0);
});
