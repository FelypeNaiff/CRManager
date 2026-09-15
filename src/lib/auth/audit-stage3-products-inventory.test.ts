import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { addAuditChange, type AuditChanges } from './audit-changes';
import { sanitizeAuditDetails } from './audit-sanitization';

const products = readFileSync(new URL('../crm/products-actions.ts', import.meta.url), 'utf8');
const createSection = products.slice(products.indexOf('export async function createProduct(input'), products.indexOf('export async function updateProduct'));
const updateSection = products.slice(products.indexOf('export async function updateProduct'), products.indexOf('export async function deleteProduct'));
const deleteSection = products.slice(products.indexOf('export async function deleteProduct'), products.indexOf('export async function getInventoryMovements'));
const inventorySection = products.slice(products.indexOf('export async function createInventoryMovement'), products.indexOf('export async function getProductPriceHistory'));
const productImport = readFileSync(new URL('../sales/actions/import-products-action.ts', import.meta.url), 'utf8');

test('product create generates a canonical critical log in the business transaction', () => {
  assert.equal(createSection.match(/action: 'PRODUCT_CREATE'/g)?.length, 1);
  assert.match(createSection, /policy: 'CRITICAL', tx/);
});

test('product update records only effective deltas', () => {
  assert.match(updateSection, /addAuditChange\(productChanges/);
  assert.match(updateSection, /metadata: \{ changes: productChanges \}/);
  const changes: AuditChanges = {};
  addAuditChange(changes, 'name', 'Camiseta', 'Camiseta');
  addAuditChange(changes, 'categoryId', 'old-category', 'new-category');
  assert.deepEqual(changes, { categoryId: { before: 'old-category', after: 'new-category' } });
});

test('product status change records before and after', () => {
  assert.match(deleteSection, /action: 'PRODUCT_STATUS_CHANGE'/);
  assert.match(deleteSection, /isActive: \{ before: true, after: false \}/);
});

test('price and cost Decimal values are normalized to numbers in deltas', () => {
  assert.match(updateSection, /Number\(defaultVariant\.costPrice\)/);
  assert.match(updateSection, /Number\(defaultVariant\.salePrice\)/);
});

test('default variant create generates its own event with the affected record id', () => {
  assert.match(createSection, /action: 'PRODUCT_VARIANT_CREATE'/);
  assert.match(createSection, /recordId: defaultVariant\.id/);
  assert.match(productImport, /action: 'PRODUCT_VARIANT_CREATE'/);
});

test('variant update generates a delta event', () => {
  assert.match(updateSection, /action: 'PRODUCT_VARIANT_UPDATE'/);
  assert.match(updateSection, /metadata: \{ productId: id, changes: variantChanges \}/);
  assert.match(productImport, /action: 'PRODUCT_VARIANT_UPDATE'/);
});

test('manual stock adjustment records before, after and delta', () => {
  assert.match(inventorySection, /action: manualAuditAction/);
  assert.match(inventorySection, /beforeQuantity: currentStock/);
  assert.match(inventorySection, /afterQuantity: newCurrentStock/);
  assert.match(inventorySection, /delta: quantity/);
  assert.match(productImport, /'STOCK_ENTRY' : 'STOCK_EXIT'/);
});

test('tenant isolation is applied to target reads and writes', () => {
  assert.match(updateSection, /companyId: session\.companyId/);
  assert.match(deleteSection, /tenantWhere\(id, session\.companyId\)/);
  assert.match(inventorySection, /tenantWhere\(variantId, session\.companyId\)/);
});

test('operational actor is derived from the trusted server context', () => {
  assert.match(inventorySection, /context: session/);
  assert.doesNotMatch(inventorySection, /context:\s*input/);
});

test('direct admin actor uses the same trusted context path', () => {
  assert.match(createSection, /context: session/);
  assert.doesNotMatch(createSection, /authenticatedUserId:\s*input|actorUserId:\s*input/);
});

test('client supplied actor ids are never audit authority', () => {
  for (const section of [createSection, updateSection, deleteSection, inventorySection]) {
    assert.doesNotMatch(section, /actorUserId:\s*input|authenticatedUserId:\s*input|companyId:\s*input/);
  }
});

test('critical audit failures share the transaction and therefore roll back mutations', () => {
  for (const section of [createSection, updateSection, deleteSection, inventorySection]) {
    assert.match(section, /prisma\.\$transaction\(async \(tx\)/);
    assert.match(section, /policy: 'CRITICAL', tx/);
  }
  assert.match(productImport, /prisma\.\$transaction\(async \(tx\)/);
  assert.match(productImport, /policy: 'CRITICAL', tx/);
});

test('target operations do not retain duplicate legacy audit calls', () => {
  for (const section of [createSection, updateSection, deleteSection, inventorySection]) {
    assert.doesNotMatch(section, /writeLegacyActivityLog\(/);
  }
  assert.doesNotMatch(productImport, /writeLegacyActivityLog\(/);
});

test('zero quantity adjustment is rejected and unchanged deltas are omitted', () => {
  const schema = readFileSync(new URL('../crm/products-schemas.ts', import.meta.url), 'utf8');
  assert.match(schema, /refine\(v => v !== 0/);
  assert.match(updateSection, /Object\.keys\(productChanges\)\.length > 0/);
  assert.match(updateSection, /Object\.keys\(variantChanges\)\.length > 0/);
});

test('free text reason is sanitized before audit persistence', () => {
  assert.match(inventorySection, /sanitizeAuditDetails\(reason/);
  assert.equal(sanitizeAuditDetails('ajuste token=secret-value'), 'ajuste token=[REDACTED]');
});

test('sale, exchange and return stock movements are explicitly excluded from stage 3 audit mapping', () => {
  assert.match(inventorySection, /type === 'INITIAL' \|\| type === 'PURCHASE'/);
  assert.match(inventorySection, /type === 'LOSS' \|\| type === 'DAMAGE'/);
  const mapper = inventorySection.slice(inventorySection.indexOf('const manualAuditAction'), inventorySection.indexOf('if (manualAuditAction)'));
  assert.doesNotMatch(mapper, /type === 'SALE'|type === 'EXCHANGE'|type === 'RETURN'/);
});
