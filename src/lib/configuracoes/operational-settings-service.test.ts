import test from 'node:test';
import assert from 'node:assert/strict';
import { OperationalSettingsService } from './operational-settings-service';

const settings = {
  allowDiscount: true,
  requireAuthorizationAboveLimit: true,
  sellerDiscountLimit: 5,
  managerDiscountLimit: 15,
  adminDiscountLimit: 100,
};

function policy(user: any, discountPercent: number, companyId = 'company-a') {
  let where: any;
  const tx = { user: { findFirst: async (args: any) => (where = args.where, user?.companyId === args.where.companyId ? user : null) } };
  const service = { ...OperationalSettingsService, getOrCreateOperationalSettings: async () => settings } as any;
  return { result: service.validateDiscountPolicy({ companyId, userId: 'user-a', discountPercent, saleTotal: 100 }, tx), getWhere: () => where };
}

test('individual User limit allows discounts below and exactly at the limit', async () => {
  const user = { id: 'user-a', companyId: 'company-a', maxDiscountPercentage: 10, role: null };
  assert.deepEqual(await policy(user, 9).result, { allowed: true, requiresAuthorization: false, limitApplied: 10 });
  assert.deepEqual(await policy(user, 10).result, { allowed: true, requiresAuthorization: false, limitApplied: 10 });
});

test('discount above the individual limit requires authorization', async () => {
  const user = { id: 'user-a', companyId: 'company-a', maxDiscountPercentage: 10, role: null };
  const result = await policy(user, 11).result;
  assert.equal(result.allowed, false);
  assert.equal(result.requiresAuthorization, true);
  assert.equal(result.limitApplied, 10);
});

test('Role limit is used when User has no explicit limit', async () => {
  const user = { id: 'user-a', companyId: 'company-a', maxDiscountPercentage: null, role: { maxDiscountPercentage: 15, isAdmin: false, permissions: [] } };
  assert.equal((await policy(user, 15).result).limitApplied, 15);
});

test('seller settings limit is the final fallback', async () => {
  const user = { id: 'user-a', companyId: 'company-a', maxDiscountPercentage: null, role: { maxDiscountPercentage: null, isAdmin: false, permissions: [] } };
  assert.equal((await policy(user, 5).result).limitApplied, 5);
});

test('User discount lookup is constrained to the requested tenant', async () => {
  const external = { id: 'user-a', companyId: 'company-b', maxDiscountPercentage: 100, role: null };
  const check = policy(external, 50, 'company-a');
  await assert.rejects(check.result, /Usuário não encontrado/);
  assert.deepEqual(check.getWhere(), { id: 'user-a', companyId: 'company-a' });
});
