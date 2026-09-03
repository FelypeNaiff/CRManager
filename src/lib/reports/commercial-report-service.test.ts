import assert from 'node:assert/strict';
import test from 'node:test';
import { CommercialReportService } from './commercial-report-service';

const decimal = (value: number) => ({ toNumber: () => value });

function createReportDb(goals: any[], commissions: any[]) {
  const calls: Array<{ model: string; args: any }> = [];
  return {
    calls,
    db: {
      sellerGoal: {
        findMany: async (args: any) => (calls.push({ model: 'goal', args }), goals),
      },
      sellerCommission: {
        findMany: async (args: any) => (calls.push({ model: 'commission', args }), commissions),
      },
    },
  };
}

test('aggregates goals and commissions by Seller without mixing Sellers', async () => {
  const fake = createReportDb(
    [
      { sellerId: 'seller-a', seller: { name: 'Seller A' }, targetAmount: decimal(1000), achievedAmount: decimal(500) },
      { sellerId: 'seller-b', seller: { name: 'Seller B' }, targetAmount: decimal(2000), achievedAmount: decimal(250) },
    ],
    [
      { sellerId: 'seller-a', seller: { name: 'Seller A' }, amount: decimal(40), status: 'PENDING' },
      { sellerId: 'seller-b', seller: { name: 'Seller B' }, amount: decimal(70), status: 'PAID' },
    ],
  );
  const result = await new CommercialReportService(fake.db as any)
    .getGoalsAndCommissionsReport({ companyId: 'company-a' });

  assert.deepEqual(result, [
    { sellerName: 'Seller A', target: 1000, achieved: 500, pendingComm: 40, paidComm: 0, cancelledComm: 0, percentAchieved: 50 },
    { sellerName: 'Seller B', target: 2000, achieved: 250, pendingComm: 0, paidComm: 70, cancelledComm: 0, percentAchieved: 12.5 },
  ]);
});

test('keeps Seller with a goal and no commission', async () => {
  const fake = createReportDb(
    [{ sellerId: 'seller-a', seller: { name: 'Seller A' }, targetAmount: decimal(500), achievedAmount: decimal(100) }],
    [],
  );
  const [result] = await new CommercialReportService(fake.db as any)
    .getGoalsAndCommissionsReport({ companyId: 'company-a' });
  assert.deepEqual(result, {
    sellerName: 'Seller A', target: 500, achieved: 100,
    pendingComm: 0, paidComm: 0, cancelledComm: 0, percentAchieved: 20,
  });
});

test('keeps inactive historical Seller with commission and no goal', async () => {
  const fake = createReportDb([], [
    { sellerId: 'seller-inactive', seller: { name: 'Former Seller' }, amount: decimal(30), status: 'CANCELLED' },
  ]);
  const [result] = await new CommercialReportService(fake.db as any)
    .getGoalsAndCommissionsReport({ companyId: 'company-a' });
  assert.deepEqual(result, {
    sellerName: 'Former Seller', target: 0, achieved: 0,
    pendingComm: 0, paidComm: 0, cancelledComm: 30, percentAchieved: 0,
  });
});

test('queries both models through Seller tenant and canonical sellerId filter', async () => {
  const fake = createReportDb([], []);
  const startDate = new Date('2026-08-01T00:00:00Z');
  const endDate = new Date('2026-08-31T23:59:59Z');
  await new CommercialReportService(fake.db as any).getGoalsAndCommissionsReport({
    companyId: 'company-a', sellerId: 'seller-a', startDate, endDate,
  });

  assert.deepEqual(fake.calls[0].args.where, {
    seller: { companyId: 'company-a' }, sellerId: 'seller-a',
  });
  assert.deepEqual(fake.calls[1].args.where, {
    seller: { companyId: 'company-a' }, sellerId: 'seller-a',
    sale: { createdAt: { gte: startDate, lte: endDate } },
  });
  assert.deepEqual(fake.calls[0].args.include, { seller: { select: { name: true } } });
  assert.deepEqual(fake.calls[1].args.include, { seller: { select: { name: true } } });
});
