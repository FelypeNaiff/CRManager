import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateReleasedCommission } from './commission-release-policy';

test('proportional policy releases the exact proportional amount', () => {
  const released = calculateReleasedCommission('PROPORTIONAL_TO_RECEIPTS', 10, [
    { originalAmount: 100, paidAmount: 25, status: 'PARTIAL' },
  ]);
  assert.equal(released.toFixed(2), '2.50');
});

test('recalculation is capped and therefore safe for repeated settlement events', () => {
  const receivables = [{ originalAmount: 100, paidAmount: 100, status: 'PAID' }];
  assert.equal(calculateReleasedCommission('PROPORTIONAL_TO_RECEIPTS', 10, receivables).toFixed(2), '10.00');
  assert.equal(calculateReleasedCommission('PROPORTIONAL_TO_RECEIPTS', 10, receivables).toFixed(2), '10.00');
});

test('full settlement requires every installment to be paid', () => {
  const released = calculateReleasedCommission('ON_FULL_SETTLEMENT', 10, [
    { originalAmount: 50, paidAmount: 0, status: 'PENDING' },
    { originalAmount: 50, paidAmount: 50, status: 'PAID' },
  ]);
  assert.equal(released.toFixed(2), '0.00');
});

test('first installment policy requires an actual receipt, not a due date', () => {
  assert.equal(calculateReleasedCommission('ON_FIRST_INSTALLMENT_RECEIVED', 10, [
    { originalAmount: 100, paidAmount: 0, status: 'OVERDUE' },
  ]).toFixed(2), '0.00');
});
