import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PERMISSION_CATALOG } from '@/lib/auth/permission-catalog';
import { normalizePermissionMatrix } from './permission-matrix';

test('permission matrix persists checked entries and removes unchecked entries', () => {
  const first = PERMISSION_CATALOG[0];
  const second = PERMISSION_CATALOG[1];
  const normalized = normalizePermissionMatrix([
    { module: first.module, action: first.action, allowed: true },
    { module: second.module, action: second.action, allowed: false },
  ]);
  assert.deepEqual(normalized, [{ module: first.module, action: first.action, allowed: true }]);

  const reloaded = new Set(normalized.map(permission => `${permission.module}:${permission.action}`));
  assert.equal(reloaded.has(`${first.module}:${first.action}`), true);
  assert.equal(reloaded.has(`${second.module}:${second.action}`), false);
});

test('permission matrix rejects duplicate and unknown role permission keys', () => {
  const permission = PERMISSION_CATALOG[0];
  assert.throws(() => normalizePermissionMatrix([
    { module: permission.module, action: permission.action, allowed: true },
    { module: permission.module, action: permission.action, allowed: false },
  ]), /INVALID_PERMISSION_MATRIX/);
  assert.throws(() => normalizePermissionMatrix([
    { module: 'FORGED', action: 'UPDATE', allowed: true },
  ]), /INVALID_PERMISSION_MATRIX/);
});

test('permission writes are tenant scoped and atomic', async () => {
  const source = await readFile(new URL('./permission-actions.ts', import.meta.url), 'utf8');
  const update = source.slice(source.indexOf('export async function updateRolePermissionsAction'), source.indexOf('export async function applyTemplateAction'));
  assert.match(update, /requirePermission\('GRUPOS_USUARIOS', 'UPDATE'\)/);
  assert.match(update, /where: \{ id: roleId, companyId: session\.companyId \}/);
  assert.match(update, /prisma\.\$transaction/);
  assert.match(update, /tenantRolePermissionWhere\(roleId, session\.companyId\)/);
  assert.match(update, /tx\.permission\.deleteMany/);
  assert.match(update, /tx\.permission\.createMany/);
  assert.match(update, /writeActivityLog/);
  assert.match(update, /policy: 'CRITICAL', tx/);
  assert.match(update, /permissionDelta\(previousPermissions, allowedPermissions\)/);
});

test('admin Roles rely on isAdmin bypass instead of redundant Permission rows', async () => {
  const source = await readFile(new URL('./permission-actions.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(role\.isAdmin\) \{\s*return \{ success: true \};\s*\}/);
});
