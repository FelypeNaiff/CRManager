import assert from 'node:assert/strict';
import test from 'node:test';
import { filterNavigationItems } from './navigation-permissions';
import { readFile } from 'node:fs/promises';

test('operational navigation hides forbidden nested configuration links', () => {
  const navigation = [{
    title: 'Configurações',
    items: [
      { title: 'Usuários', url: '/configuracoes/usuarios' },
      { title: 'Empresa', url: '/configuracoes/empresa' },
    ],
  }, { title: 'PDV', url: '/pdv' }];
  const allowed = new Set(['/pdv']);
  assert.deepEqual(
    filterNavigationItems(navigation, pathname => allowed.has(pathname)),
    [{ title: 'PDV', url: '/pdv' }],
  );
});

test('navigation retains a parent only when at least one nested route is allowed', () => {
  const navigation = [{
    title: 'Configurações',
    items: [
      { title: 'Usuários', url: '/configuracoes/usuarios?tab=usuarios' },
      { title: 'Empresa', url: '/configuracoes/empresa' },
    ],
  }];
  const filtered = filterNavigationItems(navigation, pathname => pathname === '/configuracoes/usuarios');
  assert.equal(filtered.length, 1);
  assert.deepEqual(filtered[0].items, [{ title: 'Usuários', url: '/configuracoes/usuarios?tab=usuarios' }]);
});

test('direct configuration routes are gated while server actions retain backend authorization', async () => {
  const [layout, gate, users, permissions] = await Promise.all([
    readFile(new URL('../../app/configuracoes/layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../components/permissions/require-permission.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../users/user-actions.ts', import.meta.url), 'utf8'),
    readFile(new URL('../permissions/permission-actions.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(layout, /<RequireRoutePermission>/);
  assert.match(gate, /canAccessRoute\(pathname\)/);
  assert.match(users, /requirePermission\('USUARIOS', 'UPDATE'\)/);
  assert.match(permissions, /requirePermission\('GRUPOS_USUARIOS', 'UPDATE'\)/);
});
