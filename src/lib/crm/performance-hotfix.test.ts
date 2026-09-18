import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const actions = source('./actions.ts');
const customersPage = source('../../app/(dashboard)/crm/clientes/page.tsx');
const childrenPage = source('../../app/(dashboard)/crm/filhos/page.tsx');

test('customer initial load uses one aggregated server action', () => {
  assert.match(customersPage, /await getCustomersPageData\(/);
  assert.doesNotMatch(customersPage, /\bgetCustomers\(|\bgetTags\(/);
});

test('aggregated customer load resolves authorization once', () => {
  const aggregate = actions.slice(actions.indexOf('export async function getCustomersPageData'), actions.indexOf('export async function createCustomer'));
  assert.equal(aggregate.match(/requireAllPermissions\(/g)?.length, 1);
  assert.doesNotMatch(aggregate, /requirePermission\(/);
});

test('customers and tags load in parallel', () => {
  assert.match(actions, /const \[customers, tags\] = await Promise\.all\(\[\s*loadCustomersForCompany[\s\S]*loadTagsForCompany/);
});

test('customer list wallet selects only balance', () => {
  const customerList = actions.slice(actions.indexOf('async function loadCustomersForCompany'), actions.indexOf('export async function getActiveCustomersCount'));
  assert.match(customerList, /wallet: \{ select: \{ balance: true \} \}/);
  assert.doesNotMatch(customerList, /wallet: true/);
});

test('customer relations keep the fields consumed by the UI', () => {
  for (const field of ['birthDate', 'gender', 'shoeSize', 'clothingSize', 'notes']) {
    assert.match(actions, new RegExp(`${field}: true`));
  }
  assert.match(actions, /tag: \{ select: \{ id: true, name: true, color: true \} \}/);
});

test('customer pagination remains bounded and uses skip and take', () => {
  assert.match(actions, /pageSize = Math\.min\(100/);
  assert.match(actions, /skip,\s*take: pageSize/);
});

test('customer count remains parallel with the page query', () => {
  assert.match(actions, /prisma\.customer\.count\(\{ where: whereClause \}\)/);
  assert.match(actions, /const \[list, total\] = await Promise\.all/);
});

test('tenant isolation remains on customers tags and children', () => {
  assert.match(actions, /const whereClause: any = \{\s*companyId,/);
  assert.match(actions, /where: \{ companyId \}/);
  assert.match(actions, /customer: \{ companyId: session\.companyId \}/);
});

test('aggregated load preserves both RBAC requirements', () => {
  assert.match(actions, /\{ module: 'CLIENTES', action: 'VIEW' \}/);
  assert.match(actions, /\{ module: 'CRM', action: 'VIEW' \}/);
});

test('customer details load history and returns in parallel', () => {
  assert.match(customersPage, /const \[historyRes, returnsRes\] = await Promise\.all\(\[\s*getCustomerHistory\(customer\.id\),\s*getCustomerExchangeReturns\(customer\.id\)/);
});

test('performance logs contain metrics only and no customer PII fields', () => {
  const logger = actions.slice(actions.indexOf('function logCrmPerformance'), actions.indexOf('async function loadCustomersForCompany'));
  assert.match(logger, /operation[\s\S]*duration_ms[\s\S]*record_count/);
  assert.doesNotMatch(logger, /name|email|phone|cpf|payload|companyId|tenant/i);
});

test('children keeps one initial action and sanitized instrumentation', () => {
  assert.equal(childrenPage.match(/await getChildren\(/g)?.length, 1);
  assert.match(actions, /crm_children_initial_load/);
  assert.match(actions, /customer: \{ select: \{ name: true \} \}/);
});
