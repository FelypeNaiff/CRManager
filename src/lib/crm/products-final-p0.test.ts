import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');
const createPage = read('src/app/(dashboard)/produtos/novo/page.tsx');
const editPage = read('src/app/(dashboard)/produtos/editar/[id]/page.tsx');
const actions = read('src/lib/crm/products-actions.ts');
const schema = read('prisma/schema.prisma');

test('product create and edit pages have no legacy Firestore runtime', () => {
  for (const source of [createPage, editPage]) {
    assert.doesNotMatch(source, /legacy-(?:firestore-)?stubs/);
    assert.doesNotMatch(source, /\b(?:getDocs|addDoc)\b/);
    assert.doesNotMatch(source, /gradesVariacoes|unidadesProdutos/);
  }
});

test('variant suggestions come from the tenant-scoped canonical ProductVariant backend', () => {
  assert.match(createPage, /getProductVariants\(\)/);
  assert.match(editPage, /getProductVariants\(\)/);
  assert.match(actions, /prisma\.productVariant\.findMany\(\{ where: \{ companyId: session\.companyId, isActive: true \}/);
  assert.match(actions, /requirePermission\('PRODUTOS', 'VIEW'\)/);
  assert.match(schema, /model ProductVariant \{/);
  assert.doesNotMatch(schema, /model (?:Grade|ProductUnit|UnitOfMeasure) \{/);
});

test('unsupported quick grade and unit writes are explicitly disabled', () => {
  assert.match(createPage, /A criação rápida de grade está desabilitada/);
  assert.match(createPage, /Cadastro de novas unidades indisponível/);
  assert.doesNotMatch(createPage, /Grade criada com sucesso|Unidade criada com sucesso/);
});

test('existing variants are loaded from getProductById and remain read-only in product edit', () => {
  assert.match(editPage, /produtoData\.variants/);
  assert.match(editPage, /variant\.name !== "Único"/);
  assert.match(editPage, /Variações existentes carregadas do ProductVariant real/);
  assert.match(editPage, /Somente leitura/);
});

test('product mutations preserve RBAC, tenant ownership and canonical audit events', () => {
  const createSection = actions.slice(actions.indexOf('export async function createProduct('), actions.indexOf('export async function updateProduct('));
  const updateSection = actions.slice(actions.indexOf('export async function updateProduct('), actions.indexOf('export async function deleteProduct('));
  assert.match(createSection, /requirePermission\('PRODUTOS', 'CREATE'\)/);
  assert.match(updateSection, /requirePermission\('PRODUTOS', 'UPDATE'\)/);
  assert.match(createSection, /companyId: session\.companyId/);
  assert.match(updateSection, /companyId: session\.companyId/);
  assert.match(createSection, /action: 'PRODUCT_CREATE'/);
  assert.match(createSection, /action: 'PRODUCT_VARIANT_CREATE'/);
  assert.match(updateSection, /action: 'PRODUCT_UPDATE'/);
  assert.match(updateSection, /action: 'PRODUCT_VARIANT_UPDATE'/);
  assert.doesNotMatch(createSection + updateSection, /writeLegacyActivityLog/);
});
