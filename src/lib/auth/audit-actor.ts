import type { ServerAuthContext } from './server-auth-context';

export interface AuditActor {
  companyId: string;
  authenticatedUserId: string;
  actorUserId: string;
  actorName: string;
  roleId: string;
  roleName: string;
}

export function resolveAuditActor(context: ServerAuthContext): Readonly<AuditActor> {
  return Object.freeze({
    companyId: context.companyId,
    authenticatedUserId: context.authenticatedUserId,
    actorUserId: context.userId,
    actorName: context.name,
    roleId: context.roleId,
    roleName: context.roleName,
  });
}
