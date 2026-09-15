import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const financial = readFileSync(new URL('../financial/financial-actions.ts', import.meta.url), 'utf8');
const receivables = readFileSync(new URL('../financial/accounts-receivable-service.ts', import.meta.url), 'utf8');
const settlement = readFileSync(new URL('../financial/receivables-actions.ts', import.meta.url), 'utf8');
const cash = readFileSync(new URL('../financial/cash-register-service.ts', import.meta.url), 'utf8');
const wallet = readFileSync(new URL('../wallet/customer-wallet-service.ts', import.meta.url), 'utf8');
const walletActions = readFileSync(new URL('../wallet/wallet-actions.ts', import.meta.url), 'utf8');
const saleReceivables = readFileSync(new URL('../financial/receivables-service.ts', import.meta.url), 'utf8');

test('financial transaction create generates a canonical log', () => assert.match(financial, /action: 'FINANCIAL_TRANSACTION_CREATE'/));
test('financial transaction update is not exposed by the current domain', () => assert.doesNotMatch(financial, /export async function updateFinancialTransaction/));
test('financial transaction payment is not a separate current mutation', () => assert.doesNotMatch(financial, /export async function payFinancialTransaction/));
test('financial transaction cancel records before and after', () => assert.match(financial, /status: \{ before: transaction\.status, after: 'CANCELLED' \}/));
test('manual receivable create generates a canonical log', () => assert.match(receivables, /action: 'RECEIVABLE_CREATE'/));
test('sale-generated receivables do not emit duplicate operational audit', () => assert.doesNotMatch(saleReceivables, /RECEIVABLE_CREATE|writeActivityLog/));
test('receivable payment generates a canonical log', () => {
  assert.match(receivables, /action: 'RECEIVABLE_PAYMENT'/);
  assert.match(settlement, /action: 'RECEIVABLE_PAYMENT'/);
});
test('cash open generates a canonical log', () => assert.match(cash, /action: 'CASH_REGISTER_OPEN'/));
test('cash close generates a canonical log', () => assert.match(cash, /action: 'CASH_REGISTER_CLOSE'/));
test('cash supply generates a canonical log', () => assert.match(cash, /'CASH_SUPPLY'/));
test('cash withdrawal generates a canonical log', () => assert.match(cash, /'CASH_WITHDRAWAL'/));
test('manual wallet credit generates a canonical log', () => assert.match(wallet, /action: 'CUSTOMER_WALLET_CREDIT'/));
test('manual wallet debit generates a canonical log', () => assert.match(wallet, /action: 'CUSTOMER_WALLET_DEBIT'/));
test('wallet adjustment records before after and delta', () => {
  assert.match(wallet, /beforeBalance: Number\(balanceBefore\)/);
  assert.match(wallet, /afterBalance: Number\(balanceAfter\)/);
  assert.match(wallet, /delta: -?Number\(amountVal\)/);
});
test('exchange and return wallet effects omit context and do not duplicate wallet audit', () => {
  const exchange = readFileSync(new URL('../exchanges/exchange-service.ts', import.meta.url), 'utf8');
  const returns = readFileSync(new URL('../returns/return-service.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(exchange, /CUSTOMER_WALLET_/);
  assert.doesNotMatch(returns, /CUSTOMER_WALLET_/);
});
test('operational actions pass base and actor context together', () => assert.equal(walletActions.match(/undefined, session/g)?.length, 3));
test('direct admin follows the same trusted context path', () => assert.match(walletActions, /requirePermission[\s\S]*undefined, session/));
test('tenant isolation remains on financial resources', () => {
  assert.match(financial, /session\.companyId/);
  assert.match(receivables, /receivableTenantWhere\(id, session\.companyId\)/);
  assert.match(cash, /companyId: session\.companyId/);
});
test('monetary metadata converts Decimal values', () => {
  assert.match(financial, /amount: Number\(newTx\.amount\)/);
  assert.match(wallet, /beforeBalance: Number\(balanceBefore\)/);
});
test('critical log writes share the business transaction', () => {
  for (const source of [financial, receivables, settlement, cash, wallet]) assert.match(source, /policy: 'CRITICAL', tx/);
});
test('legacy writers do not remain in target manual flows', () => {
  assert.doesNotMatch(receivables, /writeLegacyActivityLog/);
  assert.doesNotMatch(cash, /writeLegacyActivityLog/);
  assert.doesNotMatch(wallet, /writeLegacyActivityLog/);
  assert.doesNotMatch(settlement, /tx\.activityLog\.create/);
});
test('client authority ids are replaced by trusted session values', () => {
  assert.match(financial, /createdByUserId: session\.userId/);
  assert.match(cash, /openedByUserId: session\.userId/);
  assert.match(cash, /closedByUserId: session\.userId/);
  assert.doesNotMatch(walletActions, /companyId: data\.companyId|userId: data\.userId/);
});
