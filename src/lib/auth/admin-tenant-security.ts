import type { ServerAuthContext } from './server-auth-context';

export function tenantEntityWhere(id: string, companyId: string) {
  return { id, companyId } as const;
}

export function tenantRolePermissionWhere(roleId: string, companyId: string) {
  return { roleId, role: { companyId } } as const;
}

export function trustedAdministrativeActor(
  auth: Pick<ServerAuthContext, 'companyId' | 'userId' | 'isAdmin'>,
  _untrusted?: { companyId?: string; userId?: string; isAdmin?: boolean },
) {
  return { companyId: auth.companyId, userId: auth.userId, isAdmin: auth.isAdmin } as const;
}

export function canSetAdministrativeRole(
  auth: Pick<ServerAuthContext, 'isAdmin'>,
  currentIsAdmin: boolean,
  requestedIsAdmin: boolean,
) {
  return (!currentIsAdmin && !requestedIsAdmin) || auth.isAdmin;
}
