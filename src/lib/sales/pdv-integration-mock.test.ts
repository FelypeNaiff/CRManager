import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { SalesService } from './sales-service';
import { ReceivablesService } from '../financial/receivables-service';
import { sellerCommissionService } from './seller-commission-service';
import { authorizationService } from '../auth/authorization-service';
import { applyInventoryMovement, getOrCreateDefaultWarehouse } from '../inventory/inventory-service';
import { OperationalSettingsService } from '../configuracoes/operational-settings-service';

const decimal = (value: number) => new Prisma.Decimal(value);
const authContext: any = {
  authUserId: 'auth-base', authenticatedUserId: 'base-user', userId: 'operator-a',
  companyId: 'company-a', name: 'Operador', email: 'operator@example.invalid',
  roleId: 'role-a', roleName: 'Operador', isAdmin: false, permissions: {},
};

test('PDV Integration - Checkout Completo com Carteira, Múltiplos Pagamentos e Estoque', async () => {
  const state = {
    stocks: { 'variant-a': 10 },
    customerWallet: 100,
    walletTxs: [] as any[],
    receivables: [] as any[],
    cashMovements: [] as any[],
    finTxs: [] as any[],
    sales: [] as any[],
    movements: [] as any[]
  };

  const db: any = {
    $transaction: async (callback: any) => {
      // Mock db object that gets passed to all services
      const tx = {
        company: { findUnique: async () => ({ id: 'company-a' }) },
        seller: { findFirst: async () => ({ id: 'seller-a', companyId: 'company-a', status: 'ACTIVE' }) },
        customer: { findFirst: async () => ({ id: 'customer-a' }) },
        paymentMethod: {
          findMany: async ({ where }: any) => {
            return where.id.in.map((id: string) => {
              if (id === 'wallet') return { id, type: 'CUSTOMER_WALLET', allowsInstallments: false, settlementDays: 0 };
              if (id === 'credit') return { id, type: 'CREDIT_CARD', allowsInstallments: true, settlementDays: 30, feePercentage: decimal(0) };
              if (id === 'cash') return { id, type: 'CASH', allowsInstallments: false, settlementDays: 0 };
              return { id, type: 'OTHER' };
            });
          }
        },
        cashRegister: {
          findFirst: async () => ({ id: 'cash-register-a' }),
          update: async () => {}
        },
        productVariant: {
          findMany: async () => [{
            id: 'variant-a', name: 'Produto', sku: 'SKU-A', barcode: '', salePrice: decimal(20), costPrice: decimal(10), availableStock: decimal(state.stocks['variant-a']), product: { name: 'Produto', pdvEligible: true, commissionRate: null }
          }]
        },
        sale: {
          create: async ({ data }: any) => {
            const sale = { id: 'sale-a', ...data, items: data.items.create, payments: data.payments.create.map((p: any) => ({ ...p, paymentMethod: tx.paymentMethod.findMany({ where: { id: { in: [p.paymentMethodId] } } }).then((res: any) => res[0]) })) };
            state.sales.push(sale);
            return sale;
          },
          findUnique: async ({ where }: any) => {
            const sale = state.sales.find(s => s.id === where.id);
            if (!sale) return null;
            // simulate populated payments
            return {
              ...sale,
              payments: sale.payments.map((p: any) => ({
                ...p,
                paymentMethod: {
                  type: p.paymentMethodId === 'wallet' ? 'CUSTOMER_WALLET' : p.paymentMethodId === 'cash' ? 'CASH' : 'CREDIT_CARD',
                  name: p.paymentMethodId,
                  settlementDays: p.paymentMethodId === 'credit' ? 30 : 0,
                  feePercentage: decimal(0)
                }
              }))
            };
          }
        },
        customerWallet: {
          findUnique: async () => ({ id: 'wallet-a', customerId: 'customer-a', balance: decimal(state.customerWallet) }),
          update: async ({ data }: any) => { state.customerWallet -= Number(data.balance.decrement); }
        },
        walletTransaction: { create: async ({ data }: any) => state.walletTxs.push(data) },
        cashMovement: { create: async ({ data }: any) => state.cashMovements.push(data) },
        financialTransaction: { create: async ({ data }: any) => { state.finTxs.push(data); return { id: `fintx-${state.finTxs.length}` }; } },
        accountsReceivable: { create: async ({ data }: any) => state.receivables.push(data) },
        customerHistory: { create: async () => {} },
        actionAuthorization: { findFirst: async () => null },
        saleAuthorization: { create: async () => {} },
        inventoryMovement: { createMany: async () => {} },
        activityLog: { create: async () => {} },
        $queryRawUnsafe: async () => []
      };
      return await callback(tx);
    }
  };

  const dependencies: any = {
    operationalSettings: {
      getOrCreateOperationalSettings: async () => ({ requireOpenCashRegister: false, allowSaleWithoutCustomer: true, requireCustomerOnSale: false, allowNegativeStock: false }),
      validateDiscountPolicy: async () => ({ allowed: true })
    },
    authorization: authorizationService,
    receivables: new ReceivablesService(), // <-- USANDO A CLASSE REAL
    sellerCommission: { processSaleCommission: async () => {}, rollbackSaleCommission: async () => {} },
    inventory: {
      getOrCreateDefaultWarehouse: async () => ({ id: 'warehouse-a' }),
      applyInventoryMovement: async (_tx: any, context: any, input: any) => {
        state.stocks['variant-a'] -= Math.abs(Number(input.physicalDelta));
        state.movements.push(input);
      }
    }
  };

  const service = new SalesService(db, dependencies);

  // Cenário de Venda Mista: 100 reais totais. 20 na carteira, 80 no cartão.
  const input = {
    channel: 'COUNTER', companyId: 'company-a', sellerId: 'seller-a', customerId: 'customer-a',
    subtotal: 100, discountAmount: 0, totalAmount: 100,
    items: [{ variantId: 'variant-a', productNameSnapshot: 'A', variantNameSnapshot: 'P', skuSnapshot: 'A', quantity: 5, unitPrice: 20, discount: 0, totalPrice: 100, costPriceAtSale: 10, salePriceAtSale: 20, marginAtSale: 50 }],
    payments: [
      { paymentMethodId: 'wallet', amount: 20, installments: 1 },
      { paymentMethodId: 'credit', amount: 80, installments: 2 }
    ]
  };

  const sale: any = await service.createSale(input as any, 'operator-a', authContext);
  
  assert.equal(sale.id, 'sale-a');
  
  // 1. Estoque debitado
  assert.equal(state.stocks['variant-a'], 5, 'Estoque baixou de 10 para 5');
  assert.equal(state.movements.length, 1, 'Movement tracking for the variant');

  // 2. Transação Atômica: Saldo debitado e recebíveis corretos
  assert.equal(state.customerWallet, 80, 'Carteira debitou de 100 para 80');
  assert.equal(state.walletTxs.length, 1);
  assert.equal(state.walletTxs[0].type, 'DEBIT');
  assert.equal(Number(state.walletTxs[0].amount), 20);

  // 3. Contas a receber apenas do cartão de crédito (2 parcelas de 40)
  assert.equal(state.receivables.length, 2, '2 parcelas de credit card');
  assert.equal(Number(state.receivables[0].originalAmount), 40);
  assert.equal(Number(state.receivables[1].originalAmount), 40);
  
  // Não tem receivables da carteira
  assert.equal(state.receivables.reduce((acc, curr) => acc + Number(curr.originalAmount), 0), 80, 'Apenas R$ 80 gerou contas a receber');

  // 4. Testar idempotência / bloqueios (produto sem saldo)
  const inputNoStock = {
    ...input,
    items: [{ variantId: 'variant-a', productNameSnapshot: 'A', variantNameSnapshot: 'P', skuSnapshot: 'A', quantity: 10, unitPrice: 20, discount: 0, totalPrice: 200, costPriceAtSale: 10, salePriceAtSale: 20, marginAtSale: 50 }],
  };
  
  await assert.rejects(
    service.createSale(inputNoStock as any, 'operator-a', authContext),
    /Estoque insuficiente/
  );
  
  console.log('PDV Integration Test Passed with mocked transactions!');
});
