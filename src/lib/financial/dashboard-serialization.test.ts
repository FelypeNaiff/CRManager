import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeFinancialDashboardData } from './dashboard-serialization';

const decimal = (value: number) => ({ toNumber: () => value });

test('financial dashboard serializes only monetary Decimal fields', () => {
  const result = serializeFinancialDashboardData(
    [{ id: 'bank-a', name: 'Conta', currentBalance: decimal(123.45) }],
    {
      id: 'cash-a',
      openingBalance: decimal(100),
      closingBalance: decimal(120),
      expectedBalance: decimal(125),
      difference: decimal(-5),
      bankAccount: {
        id: 'bank-a',
        initialBalance: decimal(10),
        currentBalance: decimal(123.45),
      },
    },
  );

  assert.equal(result.bankAccounts[0].currentBalance, 123.45);
  assert.equal(result.openCashRegister?.openingBalance, 100);
  assert.equal(result.openCashRegister?.closingBalance, 120);
  assert.equal(result.openCashRegister?.expectedBalance, 125);
  assert.equal(result.openCashRegister?.difference, -5);
  assert.equal(result.openCashRegister?.bankAccount.initialBalance, 10);
  assert.equal(result.openCashRegister?.bankAccount.currentBalance, 123.45);
});

test('financial dashboard preserves non-Decimal fields and nullability', () => {
  const result = serializeFinancialDashboardData(
    [{ id: 'bank-a', name: 'Conta', currentBalance: '15.50' }],
    null,
  );

  assert.deepEqual(result.bankAccounts[0], { id: 'bank-a', name: 'Conta', currentBalance: 15.5 });
  assert.equal(result.openCashRegister, null);
});
