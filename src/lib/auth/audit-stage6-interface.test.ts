import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { auditActionLabel, sanitizeAuditForDisplay } from './audit-display';

const action = readFileSync(new URL('./audit-log-actions.ts', import.meta.url), 'utf8');
const page = readFileSync(new URL('../../app/configuracoes/auditoria/page.tsx', import.meta.url), 'utf8');
const legacyLogs = readFileSync(new URL('../../app/configuracoes/logs/page.tsx', import.meta.url), 'utf8');
const legacyActivities = readFileSync(new URL('../../app/configuracoes/logs-atividades/page.tsx', import.meta.url), 'utf8');
const sidebar = readFileSync(new URL('../../components/layout/config-sidebar.tsx', import.meta.url), 'utf8');
const permissions = readFileSync(new URL('./permission-catalog.ts', import.meta.url), 'utf8');
const company = readFileSync(new URL('../configuracoes/company-actions.ts', import.meta.url), 'utf8');
const operational = readFileSync(new URL('../configuracoes/operational-settings-actions.ts', import.meta.url), 'utf8');

test('admin reaches the same LOGS VIEW protected audit page with admin bypass', () => assert.match(page, /requirePermission\('LOGS', 'VIEW'\)/));
test('user with LOGS VIEW accesses the audit action', () => assert.match(action, /requirePermission\('LOGS', 'VIEW'\)/));
test('user without LOGS VIEW is blocked server side', () => assert.equal(action.match(/requirePermission\('LOGS', 'VIEW'\)/g)?.length, 1));
test('activity log reads are tenant scoped', () => assert.match(action, /companyId: auth\.companyId/));
test('client companyId is ignored', () => assert.doesNotMatch(action, /companyId: filters\.companyId/));
test('date range filters are server side', () => assert.match(action, /createdAt\.gte[\s\S]*createdAt\.lte/));
test('actor filter is server side', () => assert.match(action, /actorUserId: filters\.actorUserId/));
test('authenticated account filter is server side', () => assert.match(action, /authenticatedUserId: filters\.authenticatedUserId/));
test('action filter is server side', () => assert.match(action, /action: filters\.action/));
test('module filter is server side', () => assert.match(action, /module: filters\.module/));
test('pagination is bounded and server side', () => {
  assert.match(action, /Math\.min\(50/); assert.match(action, /skip: \(page - 1\) \* pageSize, take: pageSize/);
});
test('logs are ordered newest first', () => assert.match(action, /orderBy: \{ createdAt: 'desc' \}/));
test('minimal select excludes hashes and secrets', () => {
  const select = action.slice(action.indexOf('select: {'), action.indexOf('actorUser:'));
  assert.doesNotMatch(select, /pin|hash|password|token|secret/i);
});
test('sensitive metadata is removed before display', () => {
  assert.deepEqual(sanitizeAuditForDisplay({ pin: '1234', cpf: 'secret', safe: 'ok', nested: { apiKey: 'x', value: 2 } }), { safe: 'ok', nested: { value: 2 } });
});
test('direct access presents base and actor without false duplication', () => assert.match(page, /Acesso direto/));
test('operational access presents authenticated account separately', () => assert.match(page, /log\.authenticatedUser\.name/));
test('friendly labels map canonical actions', () => {
  assert.equal(auditActionLabel('SALE_CREATE'), 'Venda registrada');
  assert.equal(auditActionLabel('USER_ROLE_CHANGE'), 'Grupo de acesso alterado');
});
test('official page contains no Firestore stubs', () => assert.doesNotMatch(page + action, /Firestore|legacy-stubs|useCollection/));
test('both legacy routes redirect to the official page', () => {
  assert.match(legacyLogs, /redirect\('\/configuracoes\/auditoria'\)/);
  assert.match(legacyActivities, /redirect\('\/configuracoes\/auditoria'\)/);
  assert.equal(sidebar.match(/\/configuracoes\/auditoria/g)?.length, 1);
});
test('relevant configuration mutations produce canonical critical logs', () => {
  for (const event of ['COMPANY_UPDATE', 'FINANCIAL_SETTINGS_UPDATE']) assert.match(company, new RegExp(event));
  assert.match(operational, /OPERATIONAL_SETTINGS_UPDATE/);
  assert.match(company + operational, /policy: 'CRITICAL', tx/);
});
test('configuration deltas protect sensitive defaults', () => {
  assert.match(operational, /field === 'defaultPixKey'/);
  assert.match(operational, /\{ sensitive: true \}/);
  assert.doesNotMatch(company, /addAuditChange\(changes, '(cnpjCpf|telefone|email|pixChave|bancoPrincipal|agenciaPrincipal|contaPrincipal)'/);
});
test('all audit queries use the authenticated tenant and avoid N plus one', () => {
  assert.ok((action.match(/companyId: auth\.companyId/g)?.length ?? 0) >= 3);
  assert.match(action, /Promise\.all/);
  assert.doesNotMatch(action, /for[\s\S]{0,100}prisma\./);
  assert.match(permissions, /'\^\/configuracoes\/auditoria'/);
});
