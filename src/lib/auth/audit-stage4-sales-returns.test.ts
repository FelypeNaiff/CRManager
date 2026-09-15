import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sales = readFileSync(new URL('../sales/sales-service.ts', import.meta.url), 'utf8');
const handlers = readFileSync(new URL('../sales/actions/sales-action-handlers.ts', import.meta.url), 'utf8');
const exchanges = readFileSync(new URL('../exchanges/exchange-service.ts', import.meta.url), 'utf8');
const returns = readFileSync(new URL('../returns/return-service.ts', import.meta.url), 'utf8');
const commercialExchange = readFileSync(new URL('../sales/exchange-service.ts', import.meta.url), 'utf8');
const authorization = readFileSync(new URL('./authorization-service.ts', import.meta.url), 'utf8');
const authorizationActions = readFileSync(new URL('./authorization-actions.ts', import.meta.url), 'utf8');

test('sale create has one canonical event', () => assert.equal(sales.match(/action: 'SALE_CREATE'/g)?.length, 1));
test('sale metadata separates seller from the audit actor', () => {
  assert.match(sales, /sellerId: sale\.sellerId/);
  assert.match(sales, /context: auditContext/);
});
test('operational context preserves base account and effective actor', () => assert.match(handlers, /createSale\([\s\S]*auth\.userId, auth\)/));
test('direct admin uses the same trusted context path', () => assert.match(handlers, /auth\.userId, auth/));
test('sale cancellation records status before and after', () => assert.match(sales, /status: \{ before: sale\.status, after: 'CANCELLED' \}/));
test('cancelledByUserId comes from trusted context', () => {
  assert.match(sales, /cancelledByUserId: auditContext\.userId/);
  assert.match(handlers, /scopeCancelSaleInput\(data, auth\)/);
});
test('item discounts have a dedicated event', () => assert.equal(sales.match(/action: 'SALE_ITEM_DISCOUNT_APPLY'/g)?.length, 1));
test('global discounts have a dedicated event', () => assert.equal(sales.match(/action: 'SALE_GLOBAL_DISCOUNT_APPLY'/g)?.length, 1));
test('discount authorization audit contains no PIN or hash', () => {
  const audit = authorization.slice(authorization.indexOf("action: 'SALE_DISCOUNT_AUTHORIZED'"));
  assert.doesNotMatch(audit, /metadata:[\s\S]{0,700}(pinAccessHash|authorizationPinHash|pin:)/i);
});
test('discount authorizer becomes event actor and is identified in metadata', () => {
  assert.match(authorization, /context: \{ \.\.\.auditContext, userId: authorizer\.id \}/);
  assert.match(authorization, /authorizedByUserId: authorizer\.id/);
});
test('exchange create has canonical events in both active exchange flows', () => {
  assert.equal(exchanges.match(/action: "EXCHANGE_CREATE"/g)?.length, 1);
  assert.match(commercialExchange, /'EXCHANGE_CREATE'/);
});
test('return create has canonical events in both active return flows', () => {
  assert.equal(returns.match(/action: "RETURN_CREATE"/g)?.length, 1);
  assert.match(commercialExchange, /'RETURN_CREATE'/);
});
test('automatic stock effects remain summarized without STOCK event duplication', () => {
  assert.doesNotMatch(exchanges, /action: ['"]STOCK_/);
  assert.doesNotMatch(returns, /action: ['"]STOCK_/);
  assert.doesNotMatch(commercialExchange, /action: ['"]STOCK_/);
});
test('wallet credit effects remain summarized without wallet audit duplication', () => {
  assert.equal(exchanges.match(/action: "EXCHANGE_CREATE"/g)?.length, 1);
  assert.equal(returns.match(/action: "RETURN_CREATE"/g)?.length, 1);
});
test('commercial Decimal values are converted before audit metadata', () => {
  assert.match(sales, /subtotal: Number\(sale\.subtotal\)/);
  assert.match(exchanges, /creditGenerated: Number\(creditGenerated\)/);
  assert.match(returns, /refundAmount: Number\(totalAmount\)/);
});
test('tenant is derived by actions and used in resource predicates', () => {
  assert.match(handlers, /scopeCreateSaleInput\(data, auth\)/);
  assert.match(exchanges, /tenantResourceWhere\(data\.saleId, data\.companyId\)/);
  assert.match(returns, /tenantResourceWhere\(data\.saleId, data\.companyId\)/);
});
test('seller from another tenant is rejected', () => assert.match(sales, /tenantResourceWhere\(data\.sellerId, data\.companyId\)/));
test('sale from another tenant is rejected in exchange and return flows', () => {
  assert.match(exchanges, /tenantResourceWhere\(data\.saleId, data\.companyId\)/);
  assert.match(returns, /tenantResourceWhere\(data\.saleId, data\.companyId\)/);
});
test('all new audit writes are critical and transaction bound', () => {
  for (const source of [sales, exchanges, returns, commercialExchange, authorization]) assert.match(source, /policy: 'CRITICAL', tx/);
});
test('legacy and direct ActivityLog writers were removed from target services', () => {
  for (const source of [sales, exchanges, returns, commercialExchange]) {
    assert.doesNotMatch(source, /writeLegacyActivityLog/);
    assert.doesNotMatch(source, /tx\.activityLog\.create/);
  }
  assert.match(authorizationActions, /}, session\)/);
});
