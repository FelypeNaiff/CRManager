import test from 'node:test';
import assert from 'node:assert/strict';
import { ExchangeService, type ProcessExchangeReturnInput } from './exchange-service';

const decimal = (value: number) => ({ toNumber: () => value });
const authContext: any = {
  authUserId: 'auth-base', authenticatedUserId: 'base-user', userId: 'user-a', companyId: 'company-a',
  name: 'Operador', email: 'operator@example.invalid', roleId: 'role-a', roleName: 'Operador', isAdmin: false, permissions: {},
};

function input(items: ProcessExchangeReturnInput['items'], overrides: Partial<ProcessExchangeReturnInput> = {}): ProcessExchangeReturnInput {
  return { companyId: 'company-a', saleId: 'sale-a', userId: 'user-a', type: 'RETURN', reason: 'Cliente devolveu', items, ...overrides };
}

function harness(options: { existingQuantity?: number; failLog?: boolean; tenant?: string } = {}) {
  const state = {
    stocks: { 'variant-a': { current: 10, available: 10 } },
    walletBalance: 0,
    movements: [] as any[],
    returns: [] as any[],
    logs: [] as any[],
    saleStatus: 'PAID',
    commission: { id: 'commission-a', sellerId: 'seller-a', amount: 30, status: 'PENDING' },
    goal: { id: 'goal-a', sellerId: 'seller-a', achievedAmount: 300 },
  };
  const sale = {
    id: 'sale-a', companyId: 'company-a', customerId: 'customer-a', sellerId: 'seller-a',
    status: 'PAID', totalAmount: decimal(300), customer: { id: 'customer-a' },
    items: [{ variantId: 'variant-a', quantity: decimal(3), totalPrice: decimal(300) }],
    commissions: [{ id: 'commission-a', sellerId: 'seller-a', amount: decimal(30), status: 'PENDING' }],
  };
  const existing = options.existingQuantity
    ? [{ items: [{ variantId: 'variant-a', quantity: decimal(options.existingQuantity) }] }]
    : [];

  const tx: any = {
    sale: {
      findFirst: async ({ where }: any) => where.id === sale.id && where.companyId === (options.tenant ?? sale.companyId) ? sale : null,
      update: async ({ data }: any) => { state.saleStatus = data.status; return { ...sale, ...data }; },
    },
    customer: { findFirst: async ({ where }: any) => where.id === 'customer-a' && where.companyId === 'company-a' ? { id: 'customer-a' } : null },
    productVariant: {
      count: async ({ where }: any) => where.companyId === 'company-a' && where.id.in.every((id: string) => id === 'variant-a') ? where.id.in.length : 0,
      update: async ({ where, data }: any) => {
        const stock = state.stocks[where.id as keyof typeof state.stocks];
        stock.current += data.currentStock.increment;
        stock.available += data.availableStock.increment;
      },
    },
    exchangeReturn: {
      findMany: async () => existing,
      create: async ({ data }: any) => { const record = { id: `return-${state.returns.length + 1}`, ...data }; state.returns.push(record); return record; },
    },
    customerWallet: {
      findUnique: async () => ({ id: 'wallet-a', customerId: 'customer-a', balance: decimal(state.walletBalance) }),
      create: async () => ({ id: 'wallet-a', customerId: 'customer-a', balance: decimal(0) }),
      update: async ({ data }: any) => { state.walletBalance += data.balance.increment; return { id: 'wallet-a' }; },
    },
    customerWalletMovement: { create: async ({ data }: any) => data },
    inventoryMovement: { create: async ({ data }: any) => { state.movements.push(data); return data; } },
    sellerCommission: {
      update: async ({ data }: any) => {
        if (data.status) state.commission.status = data.status;
        if (data.amount?.decrement) state.commission.amount -= data.amount.decrement;
        return state.commission;
      },
    },
    sellerGoal: {
      findFirst: async ({ where }: any) => where.sellerId === 'seller-a' && where.seller?.companyId === 'company-a' ? state.goal : null,
      update: async ({ data }: any) => { state.goal.achievedAmount -= data.achievedAmount.decrement; return state.goal; },
    },
    activityLog: { create: async ({ data }: any) => { if (options.failLog) throw new Error('log failed'); state.logs.push(data); return data; } },
  };
  const db: any = {
    $transaction: async (callback: any) => {
      const snapshot = structuredClone(state);
      try { return await callback(tx); } catch (error) { Object.assign(state, snapshot); throw error; }
    },
  };
  return { service: new ExchangeService(db), state };
}

test('partial RESALE return credits proportional wallet value and restores available stock', async () => {
  const { service, state } = harness();
  const result = await service.processExchangeReturn(input([{ variantId: 'variant-a', quantity: 1, condition: 'RESALE' }]), authContext);
  assert.equal(result.totalCredit, 100);
  assert.equal(state.saleStatus, 'PARTIALLY_RETURNED');
  assert.deepEqual(state.stocks['variant-a'], { current: 11, available: 11 });
  assert.equal(state.movements[0].type, 'RETURN');
  assert.equal(state.walletBalance, 100);
  assert.equal(state.commission.amount, 20);
  assert.equal(state.goal.achievedAmount, 200);
  assert.equal(state.logs[0].action, 'RETURN_CREATE');
  assert.equal(state.logs[0].authenticatedUserId, 'base-user');
  assert.equal(state.returns[0].companyId, 'company-a');
  assert.equal(state.returns[0].customerId, 'customer-a');
});

test('total return after a previous partial return completes sale without restocking damaged items', async () => {
  const { service, state } = harness({ existingQuantity: 1 });
  const result = await service.processExchangeReturn(input([{ variantId: 'variant-a', quantity: 2, condition: 'DAMAGED' }]));
  assert.equal(result.totalCredit, 200);
  assert.equal(state.saleStatus, 'RETURNED');
  assert.deepEqual(state.stocks['variant-a'], { current: 10, available: 10 });
  assert.equal(state.movements[0].type, 'DAMAGE');
  assert.equal(state.walletBalance, 200);
  assert.equal(state.commission.status, 'CANCELLED');
  assert.equal(state.goal.achievedAmount, 100);
});

test('DISCARD creates loss movement without returning stock', async () => {
  const { service, state } = harness();
  await service.processExchangeReturn(input([{ variantId: 'variant-a', quantity: 1, condition: 'DISCARD' }]));
  assert.equal(state.movements[0].type, 'LOSS');
  assert.deepEqual(state.stocks['variant-a'], { current: 10, available: 10 });
});

test('previously returned quantity prevents duplicate or excessive return without credit', async () => {
  const { service, state } = harness({ existingQuantity: 3 });
  await assert.rejects(service.processExchangeReturn(input([{ variantId: 'variant-a', quantity: 1, condition: 'RESALE' }])), /excede disponível/);
  assert.equal(state.walletBalance, 0);
  assert.equal(state.returns.length, 0);
  assert.equal(state.movements.length, 0);
});

test('cross-tenant sale and item outside the original sale fail closed', async () => {
  const crossTenant = harness({ tenant: 'company-b' });
  await assert.rejects(crossTenant.service.processExchangeReturn(input([{ variantId: 'variant-a', quantity: 1, condition: 'RESALE' }])), /Venda não encontrada/);
  const ownTenant = harness();
  await assert.rejects(ownTenant.service.processExchangeReturn(input([{ variantId: 'variant-external', quantity: 1, condition: 'RESALE' }])), /Item inválido/);
});

test('historical rollback uses sale sellerId and does not require an active Seller', async () => {
  const { service, state } = harness();
  await service.processExchangeReturn(input([{ variantId: 'variant-a', quantity: 1, condition: 'RESALE' }]));
  assert.equal(state.commission.sellerId, 'seller-a');
  assert.equal(state.goal.sellerId, 'seller-a');
  assert.equal(state.commission.amount, 20);
});

test('transaction rollback removes stock, wallet, commission, goal and return effects after late failure', async () => {
  const { service, state } = harness({ failLog: true });
  await assert.rejects(service.processExchangeReturn(input([{ variantId: 'variant-a', quantity: 1, condition: 'RESALE' }]), authContext), /log failed/);
  assert.deepEqual(state.stocks['variant-a'], { current: 10, available: 10 });
  assert.equal(state.walletBalance, 0);
  assert.equal(state.commission.amount, 30);
  assert.equal(state.goal.achievedAmount, 300);
  assert.equal(state.saleStatus, 'PAID');
  assert.equal(state.returns.length, 0);
});
