import assert from 'node:assert/strict';
import test from 'node:test';
import { SellerCommissionService } from './seller-commission-service';

function createTransaction(options: { seller?: any; goals?: any[]; commissions?: any[] } = {}) {
  const calls: Array<{ operation: string; args: any }> = [];
  const seller = options.seller === undefined
    ? { id: 'seller-a', companyId: 'company-a', status: 'ACTIVE', commissionRate: 10 }
    : options.seller;
  const goals = options.goals ?? [{ id: 'goal-a', sellerId: 'seller-a', achievedAmount: 100 }];
  const commissions = options.commissions ?? [{ id: 'commission-a', sellerId: 'seller-a', saleId: 'sale-a', status: 'PENDING' }];
  const tx = {
    seller: { findFirst: async (args: any) => (calls.push({ operation: 'seller.findFirst', args }), seller) },
    sellerGoal: {
      findMany: async (args: any) => (calls.push({ operation: 'goal.findMany', args }), goals),
      update: async (args: any) => {
        calls.push({ operation: 'goal.update', args });
        const goal = goals.find(item => item.id === args.where.id);
        if (goal) goal.achievedAmount = args.data.achievedAmount;
        return args;
      },
      updateMany: async (args: any) => {
        calls.push({ operation: 'goal.updateMany', args });
        const goal = goals.find(item => item.id === args.where.id);
        if (!goal) return { count: 0 };
        const current = Number(goal.achievedAmount);
        const matchesGte = args.where.achievedAmount?.gte === undefined || current >= Number(args.where.achievedAmount.gte);
        const matchesGt = args.where.achievedAmount?.gt === undefined || current > Number(args.where.achievedAmount.gt);
        if (!matchesGte || !matchesGt) return { count: 0 };
        goal.achievedAmount = typeof args.data.achievedAmount === 'number'
          ? args.data.achievedAmount
          : current - Number(args.data.achievedAmount.decrement);
        return { count: 1 };
      },
    },
    sellerCommission: {
      create: async (args: any) => (calls.push({ operation: 'commission.create', args }), args),
      findMany: async (args: any) => (calls.push({ operation: 'commission.findMany', args }), commissions),
      update: async (args: any) => {
        calls.push({ operation: 'commission.update', args });
        const commission = commissions.find(item => item.id === args.where.id);
        if (commission) commission.status = args.data.status;
        return args;
      },
    },
  };
  return { tx, calls };
}

const sale = {
  id: 'sale-a', sellerId: 'seller-a', companyId: 'company-a', totalAmount: 100,
  createdAt: new Date('2026-08-01T12:00:00Z'),
};

test('sale finds Seller and goal by sellerId, increments goal and creates commission', async () => {
  const fake = createTransaction();
  const settings = async () => ({ enableSellerGoals: true, enableCommissions: true, defaultCommissionRate: 5 });
  await new SellerCommissionService(settings as any).processSaleCommission(fake.tx, sale);

  assert.deepEqual(fake.calls.find(c => c.operation === 'seller.findFirst')!.args.where,
    { id: 'seller-a', companyId: 'company-a' });
  assert.equal(fake.calls.find(c => c.operation === 'goal.findMany')!.args.where.sellerId, 'seller-a');
  assert.deepEqual(fake.calls.find(c => c.operation === 'goal.update')!.args.data,
    { achievedAmount: { increment: 100 } });
  assert.deepEqual(fake.calls.find(c => c.operation === 'commission.create')!.args.data, {
    sellerId: 'seller-a', saleId: 'sale-a', amount: 10, status: 'PENDING',
  });
});

test('zero individual rate falls back to OperationalSettings default rate', async () => {
  const fake = createTransaction({ seller: { id: 'seller-a', companyId: 'company-a', status: 'ACTIVE', commissionRate: 0 } });
  const settings = async () => ({ enableSellerGoals: false, enableCommissions: true, defaultCommissionRate: 7.5 });
  await new SellerCommissionService(settings as any).processSaleCommission(fake.tx, sale);
  assert.equal(fake.calls.find(c => c.operation === 'commission.create')!.args.data.amount, 7.5);
});

test('absence of an active goal does not prevent the current commission behavior', async () => {
  const fake = createTransaction({ goals: [] });
  const settings = async () => ({ enableSellerGoals: true, enableCommissions: true, defaultCommissionRate: 5 });
  await new SellerCommissionService(settings as any).processSaleCommission(fake.tx, sale);
  assert.equal(fake.calls.some(c => c.operation === 'goal.update'), false);
  assert.equal(fake.calls.find(c => c.operation === 'commission.create')!.args.data.sellerId, 'seller-a');
});

test('missing or inactive Seller stops processing without goals or commissions', async () => {
  for (const seller of [null, { id: 'seller-a', companyId: 'company-a', status: 'INACTIVE', commissionRate: 10 }]) {
    const fake = createTransaction({ seller });
    let settingsRead = false;
    await new SellerCommissionService(async () => (settingsRead = true, {} as any)).processSaleCommission(fake.tx, sale);
    assert.equal(settingsRead, false);
    assert.equal(fake.calls.some(c => c.operation.startsWith('goal.') || c.operation.startsWith('commission.')), false);
  }
});

test('tenant-external Seller cannot satisfy sale processing', async () => {
  const fake = createTransaction({ seller: null });
  await new SellerCommissionService(async () => ({ enableSellerGoals: true, enableCommissions: true }) as any)
    .processSaleCommission(fake.tx, { ...sale, sellerId: 'seller-b' });
  assert.deepEqual(fake.calls[0].args.where, { id: 'seller-b', companyId: 'company-a' });
  assert.equal(fake.calls.length, 1);
});

test('rollback scopes commission by seller and sale, cancels it and decrements matching goal', async () => {
  const fake = createTransaction();
  const settings = async () => ({ enableSellerGoals: true, enableCommissions: true });
  await new SellerCommissionService(settings as any).rollbackSaleCommission(fake.tx, sale);

  assert.equal(fake.calls.find(c => c.operation === 'goal.findMany')!.args.where.sellerId, 'seller-a');
  assert.deepEqual(fake.calls.find(c => c.operation === 'goal.updateMany')!.args.data,
    { achievedAmount: { decrement: 100 } });
  assert.deepEqual(fake.calls.find(c => c.operation === 'commission.findMany')!.args.where,
    { saleId: 'sale-a', sellerId: 'seller-a' });
  assert.deepEqual(fake.calls.find(c => c.operation === 'commission.update')!.args.data,
    { status: 'CANCELLED' });
});

test('rollback works when the sale Seller is now INACTIVE', async () => {
  const fake = createTransaction({
    seller: { id: 'seller-a', companyId: 'company-a', status: 'INACTIVE', commissionRate: 10 },
  });
  await new SellerCommissionService(async () => ({ enableSellerGoals: true, enableCommissions: true }) as any)
    .rollbackSaleCommission(fake.tx, sale);
  assert.equal(fake.calls.some(c => c.operation === 'goal.updateMany'), true);
  assert.equal(fake.calls.find(c => c.operation === 'commission.update')!.args.data.status, 'CANCELLED');
});

test('missing or cross-tenant Seller makes rollback fail closed', async () => {
  for (const sellerId of ['missing', 'external']) {
    const fake = createTransaction({ seller: null });
    await new SellerCommissionService(async () => ({ enableSellerGoals: true, enableCommissions: true }) as any)
      .rollbackSaleCommission(fake.tx, { ...sale, sellerId });
    assert.deepEqual(fake.calls[0].args.where, { id: sellerId, companyId: 'company-a' });
    assert.equal(fake.calls.length, 1);
  }
});

test('repeated rollback uses CANCELLED commission as marker and does not decrement goal twice', async () => {
  const goals = [{ id: 'goal-a', sellerId: 'seller-a', achievedAmount: 150 }];
  const commissions = [{ id: 'commission-a', sellerId: 'seller-a', saleId: 'sale-a', status: 'PENDING' }];
  const fake = createTransaction({ goals, commissions });
  const service = new SellerCommissionService(async () => ({ enableSellerGoals: true, enableCommissions: true }) as any);

  await service.rollbackSaleCommission(fake.tx, sale);
  await service.rollbackSaleCommission(fake.tx, sale);

  assert.equal(goals[0].achievedAmount, 50);
  assert.equal(fake.calls.filter(c => c.operation === 'goal.updateMany').length, 1);
  assert.equal(fake.calls.filter(c => c.operation === 'commission.update').length, 1);
});

test('rollback clamps achievedAmount at zero', async () => {
  const goals = [{ id: 'goal-a', sellerId: 'seller-a', achievedAmount: 40 }];
  const fake = createTransaction({ goals });
  await new SellerCommissionService(async () => ({ enableSellerGoals: true, enableCommissions: true }) as any)
    .rollbackSaleCommission(fake.tx, sale);
  assert.equal(goals[0].achievedAmount, 0);
});

test('disabled settings or absent goals preserve the current no-op behavior', async () => {
  const fake = createTransaction({ goals: [], commissions: [] });
  const settings = async () => ({ enableSellerGoals: false, enableCommissions: false, defaultCommissionRate: 10 });
  await new SellerCommissionService(settings as any).processSaleCommission(fake.tx, sale);
  assert.equal(fake.calls.some(c => c.operation === 'goal.findMany' || c.operation === 'commission.create'), false);
});
