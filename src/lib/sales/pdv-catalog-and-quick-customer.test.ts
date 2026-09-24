import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { QuickCustomerSchema } from './actions/create-quick-customer-action';

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

test('PDV serializes Prisma-backed lists used by client components', () => {
  const searchSource = readSource('src/lib/sales/actions/search-sales-entities-action.ts');
  const paymentSource = readSource('src/lib/sales/actions/list-payment-methods-action.ts');

  assert.match(searchSource, /variants:\s*serializePrisma\(variants\)/);
  assert.match(searchSource, /customers:\s*serializePrisma\(customers\)/);
  assert.match(paymentSource, /paymentMethods:\s*serializePrisma\(paymentMethods\)/);
});

test('quick customer registration is tenant-scoped, transactional, and permission protected', () => {
  const source = readSource('src/lib/sales/actions/create-quick-customer-action.ts');

  assert.match(source, /requireAllPermissions/);
  assert.match(source, /module:\s*'CLIENTES',\s*action:\s*'CREATE'/);
  assert.match(source, /module:\s*'FILHOS',\s*action:\s*'CREATE'/);
  assert.match(source, /prisma\.\$transaction/);
  assert.match(source, /companyId:\s*session\.companyId/);
  assert.match(source, /children:\s*\{[\s\S]*?create:/);
  assert.match(source, /children:\s*z\.array/);
  assert.match(source, /\.min\(1, 'Informe pelo menos uma criança\.'\)/);
  assert.match(source, /name:\s*z\.string\(\)\.trim\(\)\.min\(2/);
  assert.match(source, /age:\s*z\.number\(\)\.int\(\)\.min\(0/);
});

test('quick customer schema accepts two valid children and refuses an empty child', () => {
  const valid = QuickCustomerSchema.safeParse({
    name: 'Cliente Teste',
    phone: '11999999999',
    children: [
      { name: 'Criança Um', age: 4 },
      { name: 'Criança Dois', age: 8 },
    ],
  });
  const invalid = QuickCustomerSchema.safeParse({
    name: 'Cliente Teste',
    phone: '11999999999',
    children: [{ name: '', age: 4 }],
  });

  assert.equal(valid.success, true);
  assert.equal(valid.success && valid.data.children.length, 2);
  assert.equal(invalid.success, false);
});

test('PDV exposes incremental product search and multiple children in quick registration', () => {
  const source = readSource('src/app/(dashboard)/pdv/page.tsx');

  assert.match(source, /setTimeout\(async \(\) =>/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /Cadastro rápido de cliente/);
  assert.match(source, /Adicionar criança/);
});

test('financial auxiliary page supports payment method update and deletion', () => {
  const source = readSource('src/app/(dashboard)/financeiro/opcoes-auxiliares/page.tsx');

  assert.match(source, /updatePaymentMethod/);
  assert.match(source, /deletePaymentMethod/);
  assert.match(source, /Salvar alterações/);
  assert.match(source, /Excluir forma de pagamento/);
});

test('held sales persist as tenant-scoped drafts without stock or financial effects', () => {
  const source = readSource('src/lib/sales/actions/draft-sale-actions.ts');

  assert.match(source, /status:\s*'DRAFT'/);
  assert.match(source, /companyId:\s*auth\.companyId/);
  assert.match(source, /prisma\.\$transaction/);
  assert.match(source, /SALE_DRAFT_SAVE/);
  assert.doesNotMatch(source, /stockMovement\.create|financialTransaction\.create|accountsReceivable\.create/);
  assert.doesNotMatch(source, /inventoryMovement\.create|processSaleCommission|generateReceivablesFromSale|SALE_CREATE/);
  assert.match(source, /where:\s*\{\s*id:\s*draftId,\s*companyId:\s*auth\.companyId,\s*status:\s*'DRAFT'/);
});

test('PDV list offers a new sale and continuation of held sales', () => {
  const source = readSource('src/app/(dashboard)/comercial/vendas/page.tsx');

  assert.match(source, /Nova venda \(PDV\)/);
  assert.match(source, /sale\.status === 'DRAFT'/);
  assert.match(source, /Continuar/);
});

test('draft completion is transaction-bound and idempotent', () => {
  const service = readSource('src/lib/sales/sales-service.ts');
  const page = readSource('src/app/(dashboard)/pdv/page.tsx');

  assert.match(service, /status = 'DRAFT' FOR UPDATE/);
  assert.match(service, /where:\s*\{\s*id:\s*data\.draftId,\s*companyId:\s*data\.companyId,\s*status:\s*'DRAFT'/);
  assert.match(service, /consumed\.count !== 1/);
  assert.match(page, /draftId:\s*draftId \|\| undefined/);
  assert.doesNotMatch(page, /consumeDraftSaleAction/);
});

test('commercial reports and dashboard exclude drafts from realized revenue', () => {
  const reports = readSource('src/lib/reports/commercial-report-service.ts');
  const crm = readSource('src/lib/crm/actions.ts');
  const dashboard = readSource('src/app/(dashboard)/dashboard/page.tsx');

  assert.doesNotMatch(reports, /status:\s*\{\s*not:\s*["']CANCELLED/);
  assert.match(reports, /status IN \('PAID', 'PENDING'\)/);
  assert.match(crm, /status:\s*\{\s*in:\s*\['PAID', 'PENDING'\]/);
  assert.match(dashboard, /\['PAID', 'PENDING'\]\.includes\(s\.status\)/);
});

test('payment method deletion is tenant-scoped, protects defaults, and only archives', () => {
  const source = readSource('src/lib/financial/financial-actions.ts');
  const deletion = source.slice(source.indexOf('export async function deletePaymentMethod'), source.indexOf('// =============================================================================', source.indexOf('export async function deletePaymentMethod')));

  assert.match(deletion, /requirePermission\('FINANCEIRO', 'DELETE'\)/);
  assert.match(deletion, /where:\s*\{\s*id,\s*companyId:\s*session\.companyId\s*\}/);
  assert.match(deletion, /method\.isSystemDefault/);
  assert.match(deletion, /isActive:\s*false,\s*archivedAt:\s*new Date\(\)/);
  assert.doesNotMatch(deletion, /paymentMethod\.delete/);
});

test('historically used payment methods cannot change financial rules', () => {
  const source = readSource('src/lib/financial/financial-actions.ts');
  const update = source.slice(source.indexOf('export async function updatePaymentMethod'), source.indexOf('export async function deletePaymentMethod'));

  assert.match(update, /salePayments:\s*true,\s*transactions:\s*true/);
  assert.match(update, /hasHistoricalReferences && changesHistoricalRule/);
  assert.match(update, /Apenas o nome pode ser alterado/);
});
