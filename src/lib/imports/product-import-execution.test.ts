import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const actions = readFileSync('src/lib/imports/product-import-actions.ts', 'utf8');
const writer = readFileSync('src/lib/crm/product-write-service.ts', 'utf8');
const migration = readFileSync('prisma/migrations/20261001210000_sprint_d_import_execution/migration.sql', 'utf8');

test('confirmation is tenant scoped and state-transition guarded', () => {
  assert.match(actions, /companyId: auth\.companyId, status: 'READY'/);
  assert.match(actions, /if \(!changed\.count\) return getProductImportBatchAction/);
});

test('row acquisition uses token and expiring lease and completion checks ownership', () => {
  assert.match(actions, /processingToken: token, leaseExpiresAt/);
  assert.match(actions, /leaseExpiresAt: \{ gt: new Date\(\) \}/);
  assert.match(actions, /where: \{ id: row\.id, processingToken: token, status: 'PROCESSING' \}/);
  assert.match(migration, /processing_token/);
});

test('commercial write audit stock effect and row completion share one transaction', () => {
  const processStart = actions.indexOf('export async function processProductImportBatchAction');
  const transactionStart = actions.indexOf('await prisma.$transaction(async tx =>', processStart);
  const transaction = actions.slice(transactionStart, actions.indexOf('} catch (error)', transactionStart));
  assert.match(transaction, /createCanonicalProduct|updateCanonicalProduct/);
  assert.match(transaction, /applyCanonicalImportStock/);
  assert.match(transaction, /status: 'COMPLETED'/);
  assert.match(writer, /policy: 'CRITICAL', tx/);
});

test('stock movement is idempotently linked and target balance detects preview drift', () => {
  assert.match(writer, /findUnique\(\{ where: \{ importRowId:/);
  assert.match(writer, /!variant\.currentStock\.equals\(input\.previewStock\)/);
  assert.match(writer, /importRowId: input\.importRowId/);
});
