import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const page = (name = 'page') => read(`src/app/(dashboard)/financeiro/${name === 'page' ? '' : `${name}/`}page.tsx`);
const routes = ['page','fluxo-caixa','contas-a-pagar','contas-a-receber','calendario','contas-bancarias','caixas','transferencias','vales','opcoes-auxiliares','relatorios','recebimentos','formas-pagamento'];
const routeSource = routes.map(page).join('\n');
const actions = read('src/lib/financial/financial-actions.ts');
const receivables = read('src/lib/financial/accounts-receivable-service.ts');
const cash = read('src/lib/financial/cash-register-service.ts');

test('dashboard financeiro usa resumo Prisma real', () => assert.match(page(), /getFinancialDashboardSummary/));
test('contas a receber não usam stub', () => assert.match(page('contas-a-receber'), /getAccountsReceivable/));
test('dados financeiros sempre usam tenant autenticado', () => {
  assert.match(actions, /companyId: session\.companyId/);
  assert.match(receivables, /companyId: session\.companyId/);
  assert.match(cash, /companyId: session\.companyId/);
});
test('baixa de recebível preserva autorização e auditoria', () => {
  const section = receivables.slice(receivables.indexOf('export async function payInstallment'), receivables.indexOf('export async function cancelReceivable'));
  assert.match(section, /requirePermission\('FINANCEIRO', 'UPDATE'\)/);
  assert.match(section, /RECEIVABLE_PAYMENT/);
});
test('contas bancárias retornam dados reais', () => assert.match(page('contas-bancarias'), /getBankAccounts/));
test('caixa atual retorna dados reais', () => assert.match(page('caixas'), /getCurrentOpenRegister/));
test('abertura e fechamento continuam ligados ao serviço', () => { assert.match(page('caixas'), /openCashRegister/); assert.match(page('caixas'), /closeCashRegister/); });
test('suprimento e sangria continuam ligados ao serviço', () => { assert.match(page('caixas'), /addCashMovement/); assert.match(page('caixas'), /REFORCO/); assert.match(page('caixas'), /SANGRIA/); });
test('fluxo de caixa usa financial transactions reais', () => assert.match(page('fluxo-caixa'), /getFinancialTransactions/));
test('calendário usa transações e recebíveis reais', () => { assert.match(page('calendario'), /getFinancialTransactions/); assert.match(page('calendario'), /getAccountsReceivable/); });
test('vales não criam segunda fonte de verdade', () => { assert.match(page('vales'), /CustomerWallet/); assert.doesNotMatch(page('vales'), /wallet-actions|customer-wallet-service/); });
test('relatório financeiro usa backend real', () => { assert.match(page('relatorios'), /getFinancialTransactions/); assert.match(page('relatorios'), /getAccountsReceivable/); });
test('usuário sem permissão é bloqueado pelos readers', () => assert.match(actions, /requirePermission\('FINANCEIRO', 'VIEW'\)/));
test('acesso direto aos gaps também é protegido', () => ['contas-a-pagar','transferencias','vales'].forEach(route => assert.match(page(route), /requirePermission\('FINANCEIRO','VIEW'\)/)));
test('Decimal é serializado antes de chegar à UI', () => { assert.match(actions, /serializePrisma/); assert.match(receivables, /serializePrisma/); assert.match(cash, /serializePrisma/); });
test('nenhuma rota financeira depende de stubs runtime', () => assert.doesNotMatch(routeSource, /legacy-stubs|legacy-firestore-stubs|firestore/i));
test('nenhum write financeiro é no-op', () => assert.doesNotMatch(routeSource, /addDoc|updateDoc|deleteDoc|writeBatch|setDoc/));
test('UI não adiciona writer duplicado de ActivityLog', () => assert.doesNotMatch(routeSource, /writeActivityLog|activityLog\.create/));
test('auth context e tenant são derivados no servidor', () => { assert.doesNotMatch(routeSource, /companyId\s*:/); assert.match(actions, /requirePermission/); });
test('gaps sem backend não fabricam operações', () => ['contas-a-pagar','transferencias','vales'].forEach(route => assert.doesNotMatch(page(route), /createFinancialTransaction|prisma\./)));
