import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import type { ServerAuthContext } from '../auth/server-auth-context';
import { approveInventorySession, applyInventoryMovement, createImmediateTransfer, createStockAdjustment, getOrCreateDefaultWarehouse, reverseImmediateTransfer, startInventorySession } from './inventory-service';

const url = process.env.TEST_DATABASE_URL;
const db = url ? new PrismaClient({ datasourceUrl: url }) : null;
const run = db ? test : test.skip;
let context: ServerAuthContext;
let variantId = '';
let defaultWarehouseId = '';
let secondWarehouseId = '';

before(async () => {
  if (!db) return;
  const marker = randomUUID();
  const company = await db.company.create({ data: { cnpjCpf: marker, razaoSocial: 'Sprint E', nomeFantasia: 'Sprint E' } });
  const role = await db.role.create({ data: { companyId: company.id, name: 'Admin', isAdmin: true } });
  const user = await db.user.create({ data: { companyId: company.id, roleId: role.id, name: 'Teste', email: `${marker}@example.test`, pinAccessHash: 'synthetic' } });
  context = { authUserId: marker, authenticatedUserId: user.id, userId: user.id, companyId: company.id, name: user.name, email: user.email, roleId: role.id, roleName: role.name, isAdmin: true, permissions: {} };
  const product = await db.product.create({ data: { companyId: company.id, name: 'Produto E', internalCode: marker, galleryUrls: [] } });
  const variant = await db.productVariant.create({ data: { companyId: company.id, productId: product.id, name: 'Único', sku: marker, costPrice: 7, salePrice: 10 } });
  variantId = variant.id;
  const first = await db.$transaction(tx => getOrCreateDefaultWarehouse(tx, company.id));
  const second = await db.warehouse.create({ data: { companyId: company.id, code: 'SECUNDARIO', name: 'Secundário' } });
  defaultWarehouseId = first.id; secondWarehouseId = second.id;
});

after(async () => {
  if (!db || !context) return;
  await db.activityLog.deleteMany({ where: { companyId: context.companyId } });
  await db.inventorySession.deleteMany({ where: { companyId: context.companyId } });
  await db.stockTransfer.deleteMany({ where: { companyId: context.companyId } });
  await db.stockAdjustment.deleteMany({ where: { companyId: context.companyId } });
  await db.user.deleteMany({ where: { companyId: context.companyId } });
  await db.role.deleteMany({ where: { companyId: context.companyId } });
  await db.company.delete({ where: { id: context.companyId } });
  await db.$disconnect();
});

run('physical reserved and available balances reconcile with aggregate projection', async () => {
  await db!.$transaction(tx => applyInventoryMovement(tx, context, { warehouseId: defaultWarehouseId, variantId, physicalDelta: 20, type: 'INITIAL', origin: 'TEST', idempotencyKey: 'e:initial' }));
  await db!.$transaction(tx => applyInventoryMovement(tx, context, { warehouseId: defaultWarehouseId, variantId, reservedDelta: 4, type: 'RESERVATION', origin: 'TEST', idempotencyKey: 'e:reserve' }));
  const [position, variant] = await Promise.all([db!.stockPosition.findFirstOrThrow({ where: { companyId: context.companyId, warehouseId: defaultWarehouseId, variantId } }), db!.productVariant.findUniqueOrThrow({ where: { id: variantId } })]);
  assert.equal(position.physicalStock.toString(), '20'); assert.equal(position.reservedStock.toString(), '4');
  assert.equal(variant.currentStock.toString(), '20'); assert.equal(variant.availableStock.toString(), '16');
});

run('idempotent adjustment and stale target version are enforced persistently', async () => {
  const position = await db!.stockPosition.findFirstOrThrow({ where: { companyId: context.companyId, warehouseId: defaultWarehouseId, variantId } });
  const input = { warehouseId: defaultWarehouseId, variantId, kind: 'DELTA' as const, quantity: '2', reason: 'Teste', idempotencyKey: 'e:adjust' };
  await db!.$transaction(tx => createStockAdjustment(tx, context, input));
  await db!.$transaction(tx => createStockAdjustment(tx, context, input));
  assert.equal(await db!.stockAdjustment.count({ where: { companyId: context.companyId, idempotencyKey: input.idempotencyKey } }), 1);
  await assert.rejects(db!.$transaction(tx => createStockAdjustment(tx, context, { ...input, kind: 'TARGET', quantity: '5', idempotencyKey: 'e:stale', expectedVersion: position.version })), /Conflito/);
});

run('optimistic concurrency prevents lost updates', async () => {
  const position = await db!.stockPosition.findFirstOrThrow({ where: { companyId: context.companyId, warehouseId: defaultWarehouseId, variantId } });
  const move = (key: string) => db!.$transaction(tx => applyInventoryMovement(tx, context, { warehouseId: defaultWarehouseId, variantId, physicalDelta: 1, type: 'MANUAL_ADJUSTMENT', origin: 'TEST', idempotencyKey: key, expectedVersion: position.version }));
  const results = await Promise.allSettled([move('e:race:1'), move('e:race:2')]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
});

run('transfer is atomic, aggregate-neutral, idempotent and reverses once', async () => {
  const before = await db!.productVariant.findUniqueOrThrow({ where: { id: variantId } });
  const input = { fromWarehouseId: defaultWarehouseId, toWarehouseId: secondWarehouseId, items: [{ variantId, quantity: 3 }], idempotencyKey: 'e:transfer', reason: 'Teste' };
  const transfer = await db!.$transaction(tx => createImmediateTransfer(tx, context, input));
  await db!.$transaction(tx => createImmediateTransfer(tx, context, input));
  const after = await db!.productVariant.findUniqueOrThrow({ where: { id: variantId } });
  assert.equal(after.currentStock.toString(), before.currentStock.toString());
  await db!.$transaction(tx => reverseImmediateTransfer(tx, context, transfer.id, 'e:transfer:reverse', 'Estorno'));
  await db!.$transaction(tx => reverseImmediateTransfer(tx, context, transfer.id, 'e:transfer:reverse', 'Estorno'));
  assert.equal(await db!.stockTransfer.count({ where: { companyId: context.companyId } }), 2);
});

run('failed second transfer leg rolls back document and first leg', async () => {
  const before = await db!.stockPosition.findFirstOrThrow({ where: { companyId: context.companyId, warehouseId: defaultWarehouseId, variantId } });
  await assert.rejects(db!.$transaction(tx => createImmediateTransfer(tx, context, { fromWarehouseId: defaultWarehouseId, toWarehouseId: secondWarehouseId, items: [{ variantId, quantity: 99999 }], idempotencyKey: 'e:rollback' })));
  const after = await db!.stockPosition.findUniqueOrThrow({ where: { companyId_warehouseId_variantId: { companyId: context.companyId, warehouseId: defaultWarehouseId, variantId } } });
  assert.equal(after.physicalStock.toString(), before.physicalStock.toString());
  assert.equal(await db!.stockTransfer.count({ where: { companyId: context.companyId, idempotencyKey: 'e:rollback' } }), 0);
});

run('counting has no effect, movement causes conflict, fresh approval is idempotent', async () => {
  const baseline = await db!.productVariant.findUniqueOrThrow({ where: { id: variantId } });
  const stale = await db!.$transaction(tx => startInventorySession(tx, context, { warehouseId: defaultWarehouseId, name: 'Contagem antiga', variantIds: [variantId] }));
  assert.equal((await db!.productVariant.findUniqueOrThrow({ where: { id: variantId } })).currentStock.toString(), baseline.currentStock.toString());
  await db!.inventoryCountItem.update({ where: { id: stale.items[0].id }, data: { countedQuantity: 8 } });
  await db!.$transaction(tx => applyInventoryMovement(tx, context, { warehouseId: defaultWarehouseId, variantId, physicalDelta: 1, type: 'MANUAL_ADJUSTMENT', origin: 'TEST', idempotencyKey: 'e:during-count' }));
  await assert.rejects(db!.$transaction(tx => approveInventorySession(tx, context, stale.id)), /Conflito/);
  const fresh = await db!.$transaction(tx => startInventorySession(tx, context, { warehouseId: defaultWarehouseId, name: 'Contagem válida', variantIds: [variantId] }));
  await db!.inventoryCountItem.update({ where: { id: fresh.items[0].id }, data: { countedQuantity: 9 } });
  await db!.$transaction(tx => approveInventorySession(tx, context, fresh.id));
  await db!.$transaction(tx => approveInventorySession(tx, context, fresh.id));
  assert.equal(await db!.inventoryMovement.count({ where: { documentId: fresh.id } }), 1);
});

run('tenant isolation rejects warehouse and variant crossing company boundaries', async () => {
  const other = await db!.company.create({ data: { cnpjCpf: randomUUID(), razaoSocial: 'Outro E', nomeFantasia: 'Outro E' } });
  try {
    const warehouse = await db!.warehouse.create({ data: { companyId: other.id, code: 'OUTRO', name: 'Outro' } });
    await assert.rejects(db!.$transaction(tx => applyInventoryMovement(tx, context, { warehouseId: warehouse.id, variantId, physicalDelta: 1, type: 'INITIAL', origin: 'TEST', idempotencyKey: 'e:tenant' })), /Depósito inválido/);
  } finally { await db!.company.delete({ where: { id: other.id } }); }
});
