import { PERMISSION_CATALOG } from '@/lib/auth/permission-catalog';

export interface PermissionSelection {
  module: string;
  action: string;
  allowed: boolean;
}

export function normalizePermissionMatrix(permissions: PermissionSelection[]) {
  const catalog = new Set(PERMISSION_CATALOG.map(permission => `${permission.module}:${permission.action}`));
  const matrix = new Map<string, boolean>();

  for (const permission of permissions) {
    const key = `${permission.module}:${permission.action}`;
    if (!catalog.has(key) || matrix.has(key) || typeof permission.allowed !== 'boolean') {
      throw new Error('INVALID_PERMISSION_MATRIX');
    }
    matrix.set(key, permission.allowed);
  }

  return PERMISSION_CATALOG
    .filter(permission => matrix.get(`${permission.module}:${permission.action}`) === true)
    .map(permission => ({ module: permission.module, action: permission.action, allowed: true as const }));
}
