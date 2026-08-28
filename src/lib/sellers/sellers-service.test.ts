import assert from 'node:assert/strict';
import test from 'node:test';
import { SellersService } from './sellers-service';

function createFake() {
  const calls: Array<{ operation: string; args: any }> = [];
  let existing: any = { id: 'seller-a', companyId: 'company-a' };
  const db = {
    seller: {
      findMany: async (args: any) => (calls.push({ operation: 'findMany', args }), []),
      findFirst: async (args: any) => (calls.push({ operation: 'findFirst', args }), existing),
      create: async (args: any) => (calls.push({ operation: 'create', args }), { id: 'seller-new', ...args.data }),
      update: async (args: any) => (calls.push({ operation: 'update', args }), { ...existing, ...args.data }),
      delete: async (args: any) => (calls.push({ operation: 'delete', args }), existing),
    },
    sale: { count: async (args: any) => (calls.push({ operation: 'sale.count', args }), 1) },
  };
  return { db, calls, setExisting: (value: any) => { existing = value; } };
}

test('creates Seller independently from User in the trusted tenant', async () => {
  const fake = createFake();
  const service = new SellersService(fake.db as any);
  await service.createSeller({ name: 'Seller A', status: 'ACTIVE', commissionRate: 5 }, 'company-a');
  const create = fake.calls.find(call => call.operation === 'create')!;
  assert.equal(create.args.data.companyId, 'company-a');
  assert.equal(create.args.data.name, 'Seller A');
  assert.equal('userId' in create.args.data, false);
});

test('lists and reads Sellers only through the trusted tenant', async () => {
  const fake = createFake();
  const service = new SellersService(fake.db as any);
  await service.getSellersByCompany('company-a', 'ACTIVE');
  await service.getSellerById('seller-a', 'company-a');
  assert.deepEqual(fake.calls[0].args.where, { companyId: 'company-a', status: 'ACTIVE' });
  assert.deepEqual(fake.calls[1].args.where, { id: 'seller-a', companyId: 'company-a' });
});

test('updates with id and companyId and hides an external Seller', async () => {
  const fake = createFake();
  const service = new SellersService(fake.db as any);
  await service.updateSeller({ id: 'seller-a', name: 'Updated' }, 'company-a');
  const update = fake.calls.find(call => call.operation === 'update')!;
  assert.deepEqual(update.args.where, { id: 'seller-a', companyId: 'company-a' });

  fake.setExisting(null);
  await assert.rejects(
    service.updateSeller({ id: 'seller-b', name: 'External' }, 'company-a'),
    /não encontrado/i,
  );
  assert.equal(fake.calls.filter(call => call.operation === 'update').length, 1);
});

test('deactivation and its sale check remain tenant scoped', async () => {
  const fake = createFake();
  const service = new SellersService(fake.db as any);
  await service.deleteSeller('seller-a', 'company-a');
  const count = fake.calls.find(call => call.operation === 'sale.count')!;
  const update = fake.calls.find(call => call.operation === 'update')!;
  assert.deepEqual(count.args.where, { sellerId: 'seller-a', companyId: 'company-a' });
  assert.deepEqual(update.args.where, { id: 'seller-a', companyId: 'company-a' });
  assert.deepEqual(update.args.data, { status: 'INACTIVE' });
});
