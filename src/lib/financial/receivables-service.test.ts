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
