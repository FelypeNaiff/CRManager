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
    user: {
      findFirst: async (args: any) => (calls.push({ operation: 'user.findFirst', args }), { id: 'user-a' }),
      findMany: async (args: any) => (calls.push({ operation: 'user.findMany', args }), []),
    },
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

test('deactivation is tenant scoped and never deletes historical Seller data', async () => {
  const fake = createFake();
  const service = new SellersService(fake.db as any);
  await service.deleteSeller('seller-a', 'company-a');
  const update = fake.calls.find(call => call.operation === 'update')!;
  assert.equal(fake.calls.some(call => call.operation === 'delete' || call.operation === 'sale.count'), false);
  assert.deepEqual(update.args.where, { id: 'seller-a', companyId: 'company-a' });
  assert.deepEqual(update.args.data, { status: 'INACTIVE' });
});

test('validates optional User link inside the tenant and stores normalized CPF', async () => {
  const calls: any[] = [];
  const db = {
    seller: {
      findFirst: async (args: any) => (calls.push(['seller.findFirst', args]), null),
      create: async (args: any) => (calls.push(['seller.create', args]), args.data),
    },
    sale: { count: async () => 0 },
    user: {
      findFirst: async (args: any) => (calls.push(['user.findFirst', args]), { id: '11111111-1111-4111-8111-111111111111' }),
    },
  };
  const service = new SellersService(db as any);
  await service.createSeller({
    name: 'Seller A', status: 'ACTIVE', commissionRate: 5,
    cpf: '529.982.247-25', userId: '11111111-1111-4111-8111-111111111111',
  }, 'company-a');
  assert.deepEqual(calls.find(call => call[0] === 'user.findFirst')[1].where, {
    id: '11111111-1111-4111-8111-111111111111', companyId: 'company-a',
  });
  assert.equal(calls.find(call => call[0] === 'seller.create')[1].data.cpf, '52998224725');
});
