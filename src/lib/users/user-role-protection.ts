export interface UserRoleAssignmentContext {
  actorIsAdmin: boolean;
  actorUserId: string;
  targetUserId: string;
  currentRoleIsAdmin: boolean;
  nextRoleIsAdmin: boolean;
  nextStatus: string;
  otherActiveAdmins: number;
}

export function assertUserRoleAssignmentAllowed(context: UserRoleAssignmentContext): void {
  if (context.nextRoleIsAdmin && !context.actorIsAdmin) {
    throw new Error('ADMIN_ROLE_FORBIDDEN');
  }

  const removesAdministrativeAccess = context.currentRoleIsAdmin
    && (context.nextStatus !== 'ACTIVE' || !context.nextRoleIsAdmin);
  if (!removesAdministrativeAccess) return;

  if (context.actorUserId === context.targetUserId) {
    throw new Error('ADMIN_SELF_LOCKOUT');
  }
  if (context.otherActiveAdmins === 0) {
    throw new Error('LAST_ADMIN');
  }
}
