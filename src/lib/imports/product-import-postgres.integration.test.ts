import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient, type ImportStockPolicy } from '@prisma/client';
import * as XLSX from 'xlsx';
import { applyCanonicalImportStock, createCanonicalProduct } from '../crm/product-write-service';
import type { ServerAuthContext } from '../auth/server-auth-context';
import { resolveServerAuthContextForTesting } from '../auth/server-auth-context';

const url = process.env.TEST_DATABASE_URL;
const enabled = Boolean(url);
const db = enabled ? new PrismaClient({ datasourceUrl: url }) : null;
const run = enabled ? test : test.skip;
const marker = `sprint-d-${randomUUID()}`;
let companyId = '';
let userId = '';
let context: ServerAuthContext;

before(async () => {
  if (!db) return;
  const company = await db.company.create({ data: { cnpjCpf: marker, razaoSocial: 'Teste Sprint D', nomeFantasia: 'Teste Sprint D' } });
  const role = await db.role.create({ data: { companyId: company.id, name: 'Admin teste', isAdmin: true } });
  const user = await db.user.create({ data: { companyId: company.id, roleId: role.id, name: 'Executor teste', email: `${marker}@example.test`, pinAccessHash: 'synthetic-not-a-real-pin' } });
  companyId = company.id; userId = user.id;
  context = { authUserId: 'synthetic-auth', authenticatedUserId: user.id, userId: user.id, companyId: company.id,
    name: user.name, email: user.email, roleId: role.id, roleName: role.name, isAdmin: true, permissions: {} };
});

after(async () => {
  if (!db) return;
  if (companyId) {
    await db.importBatch.deleteMany({ where: { companyId } });
    await db.activityLog.deleteMany({ where: { companyId } });
    await db.user.deleteMany({ where: { companyId } });
    await db.role.deleteMany({ where: { companyId } });
    await db.company.delete({ where: { id: companyId } });
  }
  await db.$disconnect();
});

async function batch(fingerprint = randomUUID(), stockPolicy: ImportStockPolicy = 'NONE') {
  if (!db) throw new Error('database disabled');
  return db.importBatch.create({ data: { companyId, createdByUserId: userId, contentHash: randomUUID(), fingerprint,
    parserVersion: 'integration-v1', mapping: {}, policies: { stockPolicy }, status: 'READY' } });
}

async function row(batchId: string, number: number, status: 'READY'|'PROCESSING'|'COMPLETED' = 'READY', stockPolicy: ImportStockPolicy = 'NONE') {
  if (!db) throw new Error('database disabled');
  return db.importBatchRow.create({ data: { batchId, rowNumber: number, operationKey: `SKU:${randomUUID()}`, status,
    proposedAction: 'CREATE', sourceData: {}, stockPolicy } });
}

run('real XLSX retains formulas and original row numbers before persistent preview', async () => {
  const ws = XLSX.utils.aoa_to_sheet([['SKU','Nome do produto *'],['001','A'],[],['002','B']]); ws.B2 = { t: 's', f: '"A"', v: 'A' };
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
  const bytes = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const parsed = XLSX.read(bytes, { type: 'buffer', cellFormula: true });
  assert.equal(parsed.Sheets.Produtos.B2.f, '"A"');
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(parsed.Sheets.Produtos, { header: 1, raw: true, blankrows: true });
  assert.equal(matrix[3][0], '002');
});

run('preview persistence has no commercial or stock effects', async () => {
  const before = await Promise.all([db!.product.count({ where: { companyId } }), db!.inventoryMovement.count()]);
  const b = await batch(); await row(b.id, 2);
  const afterCounts = await Promise.all([db!.product.count({ where: { companyId } }), db!.inventoryMovement.count()]);
  assert.deepEqual(afterCounts, before);
});

run('concurrent identical preview is constrained to one batch', async () => {
  const fingerprint = randomUUID();
  const results = await Promise.allSettled([batch(fingerprint), batch(fingerprint)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(await db!.importBatch.count({ where: { fingerprint } }), 1);
});

run('double confirmation performs one guarded transition', async () => {
  const b = await batch();
  const confirm = () => db!.importBatch.updateMany({ where: { id: b.id, companyId, status: 'READY' }, data: { status: 'PROCESSING', startedAt: new Date() } });
  const [a, c] = await Promise.all([confirm(), confirm()]);
  assert.equal(a.count + c.count, 1);
});

run('two workers cannot claim one row and stale owner cannot complete it', async () => {
  const b = await batch(); const r = await row(b.id, 2); const expires = new Date(Date.now() + 60_000);
  const claim = (token: string) => db!.importBatchRow.updateMany({ where: { id: r.id, status: 'READY' }, data: { status: 'PROCESSING', processingToken: token, leaseExpiresAt: expires } });
  const [one, two] = await Promise.all([claim('worker-one'), claim('worker-two')]);
  assert.equal(one.count + two.count, 1);
  const owner = one.count ? 'worker-one' : 'worker-two'; const stale = owner === 'worker-one' ? 'worker-two' : 'worker-one';
  assert.equal((await db!.importBatchRow.updateMany({ where: { id: r.id, processingToken: stale }, data: { status: 'COMPLETED' } })).count, 0);
  assert.equal((await db!.importBatchRow.updateMany({ where: { id: r.id, processingToken: owner }, data: { status: 'COMPLETED', processedAt: new Date() } })).count, 1);
});

run('completed rows survive interruption and are not reclaimable', async () => {
  const b = await batch(); const done = await row(b.id, 2, 'COMPLETED'); await row(b.id, 3, 'READY');
  const candidates = await db!.importBatchRow.findMany({ where: { batchId: b.id, status: { in: ['READY','FAILED'] } } });
  assert.equal(candidates.length, 1); assert.notEqual(candidates[0].id, done.id);
});

run('late failure rolls back product variant price history audit and row completion', async () => {
  const b = await batch(); const r = await row(b.id, 2, 'PROCESSING');
  const before = await Promise.all([db!.product.count({ where: { companyId } }), db!.productVariant.count({ where: { companyId } }),
    db!.supplier.count({ where: { companyId } }), db!.productPriceHistory.count(), db!.activityLog.count({ where: { companyId } })]);
  await assert.rejects(db!.$transaction(async tx => {
    await createCanonicalProduct(tx, context, { name: 'Rollback', internalCode: randomUUID(), sku: randomUUID(), salePrice: 10, supplierName: 'Fornecedor rollback' });
    await tx.importBatchRow.update({ where: { id: r.id }, data: { status: 'COMPLETED' } });
    throw new Error('synthetic late failure');
  }));
  assert.deepEqual(await Promise.all([db!.product.count({ where: { companyId } }), db!.productVariant.count({ where: { companyId } }),
    db!.supplier.count({ where: { companyId } }), db!.productPriceHistory.count(), db!.activityLog.count({ where: { companyId } })]), before);
  assert.equal((await db!.importBatchRow.findUniqueOrThrow({ where: { id: r.id } })).status, 'PROCESSING');
});

run('NONE creates canonical commercial records without stock movement', async () => {
  const b = await batch(); const r = await row(b.id, 2, 'PROCESSING');
  const created = await db!.$transaction(async tx => {
    const target = await createCanonicalProduct(tx, context, { name: 'Sem estoque', internalCode: randomUUID(), sku: randomUUID(), supplierName: 'Fornecedor sintético', costPrice: 5, salePrice: 9 });
    await applyCanonicalImportStock(tx, context, { importRowId: r.id, variantId: target.variant.id, policy: 'NONE', quantity: new Prisma.Decimal(7), previewStock: null });
    return target;
  });
  assert.equal((await db!.productVariant.findUniqueOrThrow({ where: { id: created.variant.id } })).currentStock.toString(), '0');
  assert.equal(await db!.inventoryMovement.count({ where: { importRowId: r.id } }), 0);
  assert.ok(await db!.supplier.findFirst({ where: { companyId, name: 'Fornecedor sintético' } }));
  assert.ok(await db!.productPriceHistory.findFirst({ where: { productId: created.product.id } }));
  assert.ok(await db!.activityLog.findFirst({ where: { companyId, recordId: created.product.id } }));
});

run('stock policies enforce history drift conversion and idempotent movement link', async () => {
  const createTarget = (name: string) => db!.$transaction(tx => createCanonicalProduct(tx, context, { name, internalCode: randomUUID(), sku: randomUUID() }));
  const initial = await createTarget('Inicial'); const b1 = await batch(randomUUID(), 'INITIAL_IF_NO_HISTORY'); const r1 = await row(b1.id, 2, 'PROCESSING', 'INITIAL_IF_NO_HISTORY');
  await db!.$transaction(tx => applyCanonicalImportStock(tx, context, { importRowId: r1.id, variantId: initial.variant.id, policy: 'INITIAL_IF_NO_HISTORY', quantity: new Prisma.Decimal(12), previewStock: new Prisma.Decimal(0) }));
  await db!.$transaction(tx => applyCanonicalImportStock(tx, context, { importRowId: r1.id, variantId: initial.variant.id, policy: 'INITIAL_IF_NO_HISTORY', quantity: new Prisma.Decimal(12), previewStock: new Prisma.Decimal(0) }));
  assert.equal(await db!.inventoryMovement.count({ where: { importRowId: r1.id } }), 1);
  const r2 = await row(b1.id, 3, 'PROCESSING', 'INITIAL_IF_NO_HISTORY');
  await assert.rejects(db!.$transaction(tx => applyCanonicalImportStock(tx, context, { importRowId: r2.id, variantId: initial.variant.id, policy: 'INITIAL_IF_NO_HISTORY', quantity: new Prisma.Decimal(1), previewStock: new Prisma.Decimal(12) })), /histórico/);

  const target = await createTarget('Alvo'); const b2 = await batch(randomUUID(), 'TARGET_BALANCE'); const targetRow = await row(b2.id, 2, 'PROCESSING', 'TARGET_BALANCE');
  await db!.productVariant.update({ where: { id: target.variant.id }, data: { currentStock: 1, availableStock: 1 } });
  await assert.rejects(db!.$transaction(tx => applyCanonicalImportStock(tx, context, { importRowId: targetRow.id, variantId: target.variant.id, policy: 'TARGET_BALANCE', quantity: new Prisma.Decimal(10), previewStock: new Prisma.Decimal(0) })), /mudou/);
  const targetOk = await createTarget('Alvo válido'); const targetOkRow = await row(b2.id, 3, 'PROCESSING', 'TARGET_BALANCE');
  await db!.$transaction(tx => applyCanonicalImportStock(tx, context, { importRowId: targetOkRow.id, variantId: targetOk.variant.id, policy: 'TARGET_BALANCE', quantity: new Prisma.Decimal(10), previewStock: new Prisma.Decimal(0) }));
  await db!.$transaction(tx => applyCanonicalImportStock(tx, context, { importRowId: targetOkRow.id, variantId: targetOk.variant.id, policy: 'TARGET_BALANCE', quantity: new Prisma.Decimal(10), previewStock: new Prisma.Decimal(0) }));
  assert.equal((await db!.productVariant.findUniqueOrThrow({ where: { id: targetOk.variant.id } })).currentStock.toString(), '10');
  assert.equal(await db!.inventoryMovement.count({ where: { importRowId: targetOkRow.id } }), 1);

  const additional = await createTarget('Adicional'); const b3 = await batch(randomUUID(), 'ADDITIONAL_ENTRY'); const addRow = await row(b3.id, 2, 'PROCESSING', 'ADDITIONAL_ENTRY');
  await db!.$transaction(tx => applyCanonicalImportStock(tx, context, { importRowId: addRow.id, variantId: additional.variant.id, policy: 'ADDITIONAL_ENTRY', quantity: new Prisma.Decimal(2).mul(6), previewStock: new Prisma.Decimal(0) }));
  await db!.$transaction(tx => applyCanonicalImportStock(tx, context, { importRowId: addRow.id, variantId: additional.variant.id, policy: 'ADDITIONAL_ENTRY', quantity: new Prisma.Decimal(12), previewStock: new Prisma.Decimal(0) }));
  assert.equal((await db!.productVariant.findUniqueOrThrow({ where: { id: additional.variant.id } })).currentStock.toString(), '12');
  assert.equal(await db!.inventoryMovement.count({ where: { importRowId: addRow.id } }), 1);
});

run('permissions are reloaded from persisted tenant role instead of client input', async () => {
  const permission = await db!.permission.create({ data: { roleId: context.roleId, module: 'PRODUTOS', action: 'IMPORT', allowed: true } });
  const load = async () => {
    const user = await db!.user.findUniqueOrThrow({ where: { id: userId }, include: { company: true, role: { include: { permissions: true } } } });
    return { id: user.id, companyId: user.companyId, name: user.name, email: user.email, status: user.status, permitirAcesso: user.permitirAcesso,
      company: { id: user.company.id, status: user.company.status }, role: user.role && { id: user.role.id, name: user.role.name,
        status: user.role.status, isAdmin: false, permissions: user.role.permissions.map(p => ({ module: p.module, action: p.action, allowed: p.allowed })) } };
  };
  const allowed = await resolveServerAuthContextForTesting({ getAuthenticatedIdentity: async () => ({ id: 'synthetic-auth', email: context.email, emailConfirmedAt: new Date().toISOString() }), findNeexUserByVerifiedEmail: load });
  assert.equal(allowed.permissions['PRODUTOS:IMPORT'], true);
  await db!.permission.update({ where: { id: permission.id }, data: { allowed: false } });
  const denied = await resolveServerAuthContextForTesting({ getAuthenticatedIdentity: async () => ({ id: 'synthetic-auth', email: context.email, emailConfirmedAt: new Date().toISOString() }), findNeexUserByVerifiedEmail: load });
  assert.equal(denied.permissions['PRODUTOS:IMPORT'], undefined);
});

run('tenant scope rejects a target owned by another synthetic tenant', async () => {
  const other = await db!.company.create({ data: { cnpjCpf: randomUUID(), razaoSocial: 'Outro', nomeFantasia: 'Outro' } });
  try {
    const product = await db!.product.create({ data: { companyId: other.id, name: 'Outro', internalCode: randomUUID(), galleryUrls: [] } });
    const variant = await db!.productVariant.create({ data: { companyId: other.id, productId: product.id, name: 'Único', sku: randomUUID(), costPrice: 0, salePrice: 0 } });
    const b = await batch(); const r = await row(b.id, 2, 'PROCESSING', 'ADDITIONAL_ENTRY');
    await assert.rejects(db!.$transaction(tx => applyCanonicalImportStock(tx, context, { importRowId: r.id, variantId: variant.id, policy: 'ADDITIONAL_ENTRY', quantity: new Prisma.Decimal(1), previewStock: null })), /não encontrada/);
  } finally { await db!.company.delete({ where: { id: other.id } }); }
});
