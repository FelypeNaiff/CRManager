import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { addAuditChange, permissionDelta, type AuditChanges } from './audit-changes';
import { sanitizeAuditMetadata } from './audit-sanitization';

const users = readFileSync(new URL('../users/user-actions.ts', import.meta.url), 'utf8');
const roles = readFileSync(new URL('../roles/role-actions.ts', import.meta.url), 'utf8');
const permissions = readFileSync(new URL('../permissions/permission-actions.ts', import.meta.url), 'utf8');
const crm = readFileSync(new URL('../crm/actions.ts', import.meta.url), 'utf8');

test('User create writes one critical USER_CREATE event in the business transaction', () => {
  const section = users.slice(users.indexOf('export async function createUserAction'), users.indexOf('export async function resetUserAccessPinAction'));
  assert.match(section, /prisma\.\$transaction/);
  assert.equal(section.match(/action: 'USER_CREATE'/g)?.length, 1);
  assert.match(section, /policy: 'CRITICAL', tx/);
});

test('User update records effective deltas and classifies Role or status changes', () => {
  const section = users.slice(users.indexOf('export async function updateUserAction'), users.indexOf('export async function resetUserPinAction'));
  assert.match(section, /addAuditChange\(changes, 'status'/);
  assert.match(section, /USER_ROLE_CHANGE/);
  assert.match(section, /USER_STATUS_CHANGE/);
  assert.match(section, /metadata: \{ changes \}/);
  assert.equal(section.match(/writeActivityLog\(/g)?.length, 1);
});

test('audit change builder omits unchanged fields', () => {
  const changes: AuditChanges = {};
  addAuditChange(changes, 'status', 'ACTIVE', 'ACTIVE');
  addAuditChange(changes, 'role', 'Seller', 'Manager');
  assert.deepEqual(changes, { role: { before: 'Seller', after: 'Manager' } });
});

test('access PIN reset has no PIN or hash in its audit payload', () => {
  const section = users.slice(users.indexOf('export async function resetUserAccessPinAction'), users.indexOf('export async function updateUserAction'));
  const audit = section.slice(section.indexOf('await writeActivityLog'));
  assert.match(audit, /USER_ACCESS_PIN_RESET/);
  assert.doesNotMatch(audit, /metadata:[\s\S]*(newPin|pinAccessHash|authorizationPinHash)/);
  assert.match(audit, /policy: 'CRITICAL', tx/);
});

test('Role create and update use canonical events with one critical log', () => {
  assert.equal(roles.match(/action: 'ROLE_CREATE'/g)?.length, 1);
  assert.equal(roles.match(/'ROLE_STATUS_CHANGE'/g)?.length, 1);
  assert.equal(roles.match(/'ROLE_UPDATE'/g)?.length, 1);
  assert.match(roles, /metadata: \{ changes \}/);
});

test('permission delta contains only additions and removals', () => {
  const delta = permissionDelta(
    [{ module: 'CUSTOMERS', action: 'VIEW', allowed: true }, { module: 'USERS', action: 'VIEW', allowed: true }],
    [{ module: 'CUSTOMERS', action: 'VIEW', allowed: true }, { module: 'CUSTOMERS', action: 'UPDATE', allowed: true }],
  );
  assert.deepEqual(delta, { added: ['CUSTOMERS:UPDATE'], removed: ['USERS:VIEW'] });
});

test('permission mutation and audit share the transaction and critical policy', () => {
  assert.match(permissions, /previousPermissions = await tx\.permission\.findMany/);
  assert.match(permissions, /ROLE_PERMISSIONS_UPDATE/);
  assert.match(permissions, /policy: 'CRITICAL', tx/);
  assert.doesNotMatch(permissions, /tx\.activityLog\.create/);
});

test('customer create, update and status change each have canonical critical events', () => {
  for (const action of ['CUSTOMER_CREATE', 'CUSTOMER_UPDATE', 'CUSTOMER_STATUS_CHANGE']) {
    assert.match(crm, new RegExp(action));
  }
  assert.match(crm, /module: 'CUSTOMERS'/);
});

test('customer update marks PII changes without storing before or after values', () => {
  const section = crm.slice(crm.indexOf('export async function updateCustomer'), crm.indexOf('export async function deleteCustomer'));
  assert.match(section, /\{ sensitive: true \}/);
  const changes: AuditChanges = {};
  addAuditChange(changes, 'phone', '11999999999', '11888888888', { sensitive: true });
  assert.deepEqual(changes, { phone: { changed: true } });
  assert.doesNotMatch(JSON.stringify(sanitizeAuditMetadata({ changes })), /11999999999|11888888888/);
});

test('child create, update and delete use canonical events and minimal metadata', () => {
  for (const action of ['CUSTOMER_CHILD_CREATE', 'CUSTOMER_CHILD_UPDATE', 'CUSTOMER_CHILD_DELETE']) {
    assert.equal(crm.match(new RegExp(`action: '${action}'`, 'g'))?.length, 1);
  }
  assert.match(crm, /module: 'CUSTOMER_CHILDREN'/);
  assert.match(crm, /metadata: \{ customerId:/);
});

test('CRM business, history and audit writes are transaction-bound', () => {
  const customerSection = crm.slice(crm.indexOf('export async function createCustomer'), crm.indexOf('// ─── Tag Actions'));
  assert.match(customerSection, /tx\.customer\.create/);
  assert.match(customerSection, /tx\.customerHistory\.create/);
  assert.match(customerSection, /policy: 'CRITICAL', tx/);
});

test('target operations do not retain legacy duplicate audit calls', () => {
  const userTarget = users.slice(users.indexOf('export async function createUserAction'), users.indexOf('export async function resetUserPinAction'));
  const crmTarget = crm.slice(crm.indexOf('export async function createCustomer'), crm.indexOf('// ─── Tag Actions'));
  assert.doesNotMatch(userTarget, /writeLegacyActivityLog/);
  assert.doesNotMatch(crmTarget, /writeLegacyActivityLog/);
});
