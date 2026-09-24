import test from 'node:test';
import assert from 'node:assert/strict';
import { PaymentMethodType, Prisma } from '@prisma/client';
import { ReceivablesService } from './receivables-service';

test('sale receivables use the effective actor and never derive a User from Seller', async () => {
  const state = {
    financial: [] as any[],
    cashMovements: [] as any[],
    receivables: [] as any[],
    userLookups: 0,
  };
  const tx: any = {
    sale: {
      findUnique: async () => ({
        id: 'sale-a', companyId: 'company-a', customerId: 'customer-a',
        sellerId: 'seller-commercial-a', cashRegisterId: 'cash-a',
        payments: [
          {
            amount: new Prisma.Decimal(10), installments: 1,
            paymentMethod: { id: 'cash-method', name: 'Dinheiro', type: PaymentMethodType.CASH, settlementDays: 0, feePercentage: new Prisma.Decimal(0) },
          },
          {
            amount: new Prisma.Decimal(20), installments: 1,
            paymentMethod: { id: 'pix-method', name: 'PIX', type: PaymentMethodType.PIX, settlementDays: 0, feePercentage: new Prisma.Decimal(0) },
          },
        ],
      }),
    },
    user: {
      findFirst: async () => {
        state.userLookups += 1;
        throw new Error('ReceivablesService must not look up an arbitrary User');
      },
    },
    cashRegister: { update: async ({ data }: any) => data },
    cashMovement: {
      create: async ({ data }: any) => { state.cashMovements.push(data); return data; },
    },
    financialTransaction: {
      create: async ({ data }: any) => {
        const created = { id: `financial-${state.financial.length + 1}`, ...data };
        state.financial.push(created);
        return created;
      },
    },
    accountsReceivable: {
      create: async ({ data }: any) => { state.receivables.push(data); return data; },
    },
  };

  await new ReceivablesService().generateReceivablesFromSale(
    'sale-a',
    { actorUserId: 'operator-a', authenticatedUserId: 'base-user-a' },
    tx,
  );

  assert.equal(state.userLookups, 0);
  assert.equal(state.financial.length, 2);
  assert.equal(state.financial.every(item => item.createdByUserId === 'operator-a'), true);
  assert.equal(state.financial.some(item => item.createdByUserId === 'seller-commercial-a'), false);
  assert.equal(state.cashMovements.length, 1);
  assert.equal(state.cashMovements[0].createdByUserId, 'operator-a');
  assert.equal(state.receivables.length, 1);
  assert.equal(state.receivables[0].status, 'PAID');
});

async function generateInstallments(amount: number, installments: number) {
  const state = { financial: [] as any[], receivables: [] as any[] };
  const tx: any = {
    sale: {
      findUnique: async () => ({
        id: 'sale-a', companyId: 'company-a', customerId: 'customer-a', cashRegisterId: null,
        payments: [{
          amount: new Prisma.Decimal(amount), installments,
          paymentMethod: {
            id: 'credit-method', name: 'Cartão de Crédito', type: PaymentMethodType.CREDIT_CARD,
            settlementDays: 30, feePercentage: new Prisma.Decimal(0),
          },
        }],
      }),
    },
    financialTransaction: {
      create: async ({ data }: any) => {
        const created = { id: `financial-${state.financial.length + 1}`, ...data };
        state.financial.push(created);
        return created;
      },
    },
    accountsReceivable: {
      create: async ({ data }: any) => { state.receivables.push(data); return data; },
    },
  };
  await new ReceivablesService().generateReceivablesFromSale(
    'sale-a',
    { actorUserId: 'operator-a', authenticatedUserId: 'base-user-a' },
    tx,
  );
  return state;
}

test('installment rounding preserves exactly 100.00 across three installments', async () => {
  const state = await generateInstallments(100, 3);
  assert.deepEqual(state.receivables.map(item => item.originalAmount.toFixed(2)), ['33.33', '33.33', '33.34']);
  assert.equal(state.receivables.reduce((sum, item) => sum.plus(item.originalAmount), new Prisma.Decimal(0)).toFixed(2), '100.00');
});

test('installment rounding preserves exactly 10.00 across six installments', async () => {
  const state = await generateInstallments(10, 6);
  assert.deepEqual(state.receivables.map(item => item.originalAmount.toFixed(2)), ['1.66', '1.66', '1.66', '1.66', '1.66', '1.70']);
  assert.equal(state.receivables.reduce((sum, item) => sum.plus(item.originalAmount), new Prisma.Decimal(0)).toFixed(2), '10.00');
  assert.equal(state.receivables.every((item, index) => index === 0 || item.dueDate > state.receivables[index - 1].dueDate), true);
});

test('sale cancellation scopes related RECEIVABLE_FEE by sale receivable and tenant', async () => {
  const financialUpdates: any[] = [];
  const receivableUpdates: any[] = [];
  const createdFinancial: any[] = [];
  const tx: any = {
    sale: {
      findFirst: async ({ where }: any) => where.id === 'sale-a' && where.companyId === 'company-a'
        ? { id: 'sale-a', companyId: 'company-a', customerId: null, cashRegisterId: null, payments: [] }
        : null,
    },
    financialTransaction: {
      updateMany: async (args: any) => { financialUpdates.push(args); return { count: 1 }; },
      update: async (args: any) => { financialUpdates.push(args); return args.data; },
      create: async ({ data }: any) => {
        const created = { id: 'receivable-fee-a', ...data };
        createdFinancial.push(created);
        return created;
      },
      findMany: async ({ where }: any) => where.companyId === 'company-a' && where.referenceId === 'sale-a'
        ? [{ id: 'sale-financial-a' }]
        : [],
    },
    accountsReceivable: {
      findFirst: async ({ where }: any) => where.id === 'receivable-a' && where.companyId === 'company-a'
        ? {
            id: 'receivable-a', companyId: 'company-a', customerId: 'customer-a',
            originalAmount: new Prisma.Decimal(100), status: 'PENDING',
            financialTransaction: {
              id: 'sale-financial-a', companyId: 'company-a',
              paymentMethod: {
                id: 'credit-method', companyId: 'company-a', name: 'Cartão',
                feePercentage: new Prisma.Decimal(2),
              },
            },
          }
        : null,
      update: async (args: any) => { receivableUpdates.push(args); return args.data; },
      findMany: async ({ where }: any) => where.companyId === 'company-a'
        ? [{ id: 'receivable-a' }]
        : [],
      updateMany: async (args: any) => { receivableUpdates.push(args); return { count: 1 }; },
    },
  };

  const service = new ReceivablesService();
  await service.settleReceivable(
    'receivable-a', new Date('2026-09-24T12:00:00Z'), 'operator-a', 'company-a', tx,
  );
  assert.equal(createdFinancial[0].referenceType, 'RECEIVABLE_FEE');
  assert.equal(createdFinancial[0].referenceId, 'receivable-a');

  await service.cancelReceivablesFromSale(
    'sale-a', 'operator-a', 'company-a', tx,
  );

  const feeCancellation = financialUpdates.find(update => update.where.referenceType === 'RECEIVABLE_FEE');
  assert.deepEqual(feeCancellation.where, {
    companyId: 'company-a',
    referenceType: 'RECEIVABLE_FEE',
    referenceId: { in: ['receivable-a'] },
    status: { not: 'CANCELLED' },
  });
  assert.deepEqual(feeCancellation.data, { status: 'CANCELLED' });
  assert.equal(financialUpdates.some(update => update.where.companyId !== 'company-a'), false);
  assert.equal(receivableUpdates.every(update => update.where.companyId === 'company-a'), true);
});
